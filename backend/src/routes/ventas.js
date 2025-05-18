import express from "express";
import pool from "../database.js";  // Asegúrate de que el pool esté correctamente importado
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Datos de sectores
const SECTORES = [
  "Herramientas manuales", "Herramientas eléctricas", 
  "Materiales de construcción", "Pinturas o accesorios",
  "Tuberías y plomería", "Electricidad e iluminación",
  "Seguridad industrial", "Productos de ferretería general"
];

// Helper para validar datos de la venta
const validateVentaData = (data) => {
  const { codigo_producto, cantidad, metodo_pago, precio_venta, sector } = data;
  const errors = [];

  if (!codigo_producto) errors.push("El código de producto es requerido");
  if (!cantidad) errors.push("La cantidad es requerida");
  if (!metodo_pago) errors.push("El método de pago es requerido");
  if (!precio_venta) errors.push("El precio de venta es requerido");
  if (!sector) errors.push("El sector es requerido");

  return errors;
};

// Mostrar formulario de agregar venta
router.get("/add", isLoggedIn, (req, res) => {
  res.render("ventas/add", {
    title: "Agregar Venta",
    messages: req.flash()
  });
});

// Mostrar lista de ventas
router.get("/list", isLoggedIn, async (req, res) => {
  try {
    const [ventas] = await pool.query(`
      SELECT v.Cod_Venta, v.Fecha_Venta, pv.Cod_Producto, pv.Precio_Venta, pv.Cantidad_Venta, pv.Metodo_Pago, pv.Sector
      FROM Venta v
      JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      ORDER BY v.Fecha_Venta DESC
    `);

    res.render("ventas/list", {
      title: "Lista de Ventas",
      ventas,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al obtener lista de ventas:", error);
    req.flash('error', 'Error al cargar lista de ventas');
    res.redirect('/ventas');
  }
});
router.post("/api/ventas", isLoggedIn, async (req, res) => {
  const { 
      detalles_venta,
      estado_venta = 'Completada'
  } = req.body;

  // Obtener el código del empleado directamente de la sesión
  const codigo_empleado = req.user.Cod_Empleado;

  if (!codigo_empleado || isNaN(codigo_empleado) || !detalles_venta) {
      return res.status(400).json({ 
          success: false, 
          message: "Datos incompletos o inválidos" 
      });
  }

  console.log(`Insertando venta para empleado autenticado: ${codigo_empleado}`);

  let connection;
  try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [resultVenta] = await connection.query(
          `INSERT INTO Venta (Cod_Empleado, Estado_Venta) VALUES (?, ?)`,
          [codigo_empleado, estado_venta]
      );
      const codigo_venta = resultVenta.insertId;
      console.log(`Venta ${codigo_venta} creada correctamente para empleado ${codigo_empleado}`);

      // 2. Procesar cada producto en la venta
      for (const detalle of detalles_venta) {
          const { codigo_producto, cantidad, precio_unitario, metodo_pago, sector } = detalle;
          
          // Validaciones básicas
          if (!codigo_producto || !cantidad || !precio_unitario || !metodo_pago || !sector) {
              await connection.rollback();
              return res.status(400).json({
                  success: false,
                  message: "Datos de detalles incompletos"
              });
          }

          // Verificar si el producto está vencido
          const [productoInfo] = await connection.query(
              `SELECT FechaVencimiento, Nombre FROM Producto WHERE Cod_Producto = ?`,
              [codigo_producto]
          );

          if (productoInfo.length > 0 && productoInfo[0].FechaVencimiento) {
              const fechaVencimiento = new Date(productoInfo[0].FechaVencimiento);
              const hoy = new Date();
              const nombre = productoInfo[0].Nombre_Producto || 'el producto';
              
              if (fechaVencimiento < hoy) {
                  await connection.rollback();
                  return res.status(400).json({
                      success: false,
                      message: `ADVERTENCIA: El producto "${nombre}" está vencido (Fecha de vencimiento: ${fechaVencimiento.toLocaleDateString()})`,
                      isWarning: true
                  });
              }
          }

          // Insertar detalle de venta
          await connection.query(
              `INSERT INTO ProductVenta (Cod_Venta, Cod_Producto, Precio_Venta, Cantidad_Venta, Metodo_Pago, Sector, Fecha_salida)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [codigo_venta, codigo_producto, precio_unitario, cantidad, metodo_pago, sector, new Date().toISOString().split('T')[0]]
          );

          // Descontar del inventario (método FIFO)
          let cantidadRestante = cantidad;
          const [lotes] = await connection.query(
              `SELECT Cod_Proveedor, Cantidad 
              FROM ProveProduct 
              WHERE Cod_Producto = ? AND Cantidad > 0
              ORDER BY Fecha_Entrada ASC
              FOR UPDATE`,
              [codigo_producto]
          );

          for (const lote of lotes) {
              if (cantidadRestante <= 0) break;

              const cantidadADescontar = Math.min(lote.Cantidad, cantidadRestante);
              
              await connection.query(
                  `UPDATE ProveProduct 
                  SET Cantidad = Cantidad - ? 
                  WHERE Cod_Proveedor = ? AND Cod_Producto = ?`,
                  [cantidadADescontar, lote.Cod_Proveedor, codigo_producto]
              );

              cantidadRestante -= cantidadADescontar;
          }
      }

      await connection.commit();
      return res.json({ 
          success: true, 
          message: 'Venta registrada correctamente',
          codigo_venta: codigo_venta
      });

  } catch (error) {
      await connection?.rollback();
      console.error("Error al registrar la venta:", error);
      return res.status(500).json({ 
          success: false, 
          message: 'Error al registrar la venta',
          error: error.message,
          detalles: {
              codigo_empleado_recibido: req.body.codigo_empleado,
              tipo_codigo_empleado: typeof req.body.codigo_empleado
          }
      });
  } finally {
      connection?.release();
  }
});


// API para obtener ventas (JSON)
router.get('/api/ventas', isLoggedIn, async (req, res) => {
    try {
      const [ventas] = await pool.query(`
        SELECT v.Cod_Venta, pv.Fecha_Salida, pv.Cod_Producto, pv.Precio_Venta, pv.Cantidad_Venta, pv.Metodo_Pago, pv.Sector
        FROM Venta v
        JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      `);

      res.json({ success: true, data: ventas });
    } catch (error) {
      console.error("Error al obtener ventas:", error);
      res.status(500).json({ success: false, error: 'Error al obtener ventas', details: error.message });
    }
});

// Ruta para obtener el empleado logueado - Modificado para enviar datos más claros
router.get('/empleados/api/empleados', isLoggedIn, async (req, res) => {
    try {
        const empleado = req.user;  // El empleado que está autenticado
        
        // Verificar que el empleado tenga el código necesario
        if (!empleado || !empleado.Cod_Empleado) {
            return res.status(400).json({ 
                success: false, 
                message: "No se pudo obtener el código del empleado" 
            });
        }

        res.json({
            success: true,
            data: [{
                Cod_Empleado: empleado.Cod_Empleado,
                Nombre: empleado.Nombre,
                Apellido: empleado.Apellido
            }]
        });
    } catch (error) {
        console.error("Error al obtener el empleado:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error en la solicitud",
            error: error.message 
        });
    }
});


// Ruta para obtener productos filtrados por sector
router.get("/api/productos", isLoggedIn, async (req, res) => {
  try {
    const [productos] = await pool.query(`
      SELECT 
        p.Cod_Producto, 
        p.Nombre, 
        p.Marca, 
        p.FechaVencimiento, 
        p.Precio_Compra, 
        p.Cantidad,
        p.Sector
      FROM Producto p
      WHERE p.FechaVencimiento IS NULL OR p.FechaVencimiento >= CURDATE()
    `);

    res.json({ success: true, data: productos });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  }
});

export { router };