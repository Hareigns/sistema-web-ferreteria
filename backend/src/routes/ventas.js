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
    const { rows: ventas } = await pool.query(`
      SELECT v.cod_venta, pv.fecha_salida, pv.cod_producto, pv.precio_venta, 
             pv.cantidad_venta, pv.metodo_pago, pv.sector
      FROM venta v
      JOIN productventa pv ON v.cod_venta = pv.cod_venta
      ORDER BY pv.fecha_salida ASC
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
  const codigo_empleado = req.user.cod_empleado;

  if (!codigo_empleado || isNaN(codigo_empleado) || !detalles_venta) {
      return res.status(400).json({ 
          success: false, 
          message: "Datos incompletos o inválidos" 
      });
  }

  console.log(`Insertando venta para empleado autenticado: ${codigo_empleado}`);

  let client;
  try {
        client = await pool.connect();
        await client.query('BEGIN');

        const ventaResult = await client.query(
            `INSERT INTO venta (cod_empleado, estado_venta) VALUES ($1, $2) RETURNING cod_venta`,
            [codigo_empleado, estado_venta]
        );
        const codigo_venta = ventaResult.rows[0].cod_venta;

        // Obtener fecha actual en formato YYYY-MM-DD para Nicaragua (UTC-6)
        const now = new Date();
        // Ajustar a hora de Nicaragua (UTC-6)
        const nicaraguaTime = new Date(now.getTime() - (6 * 60 * 60 * 1000));
        const fechaVenta = nicaraguaTime.toISOString().split('T')[0];

      for (const detalle of detalles_venta) {
          const { codigo_producto, cantidad, precio_unitario, metodo_pago, sector } = detalle;
          
          // Validaciones básicas
          if (!codigo_producto || !cantidad || !precio_unitario || !metodo_pago || !sector) {
              await client.query('ROLLBACK');
              return res.status(400).json({
                  success: false,
                  message: "Datos de detalles incompletos"
              });
          }

          // Verificar si el producto está vencido
          const productoInfoResult = await client.query(
              `SELECT fechavencimiento, nombre FROM producto WHERE cod_producto = $1`,
              [codigo_producto]
          );

          if (productoInfoResult.rows.length > 0 && productoInfoResult.rows[0].fechavencimiento) {
              const fechaVencimiento = new Date(productoInfoResult.rows[0].fechavencimiento);
              const hoy = new Date();
              const nombre = productoInfoResult.rows[0].nombre || 'el producto';
              
              if (fechaVencimiento < hoy) {
                  await client.query('ROLLBACK');
                  return res.status(400).json({
                      success: false,
                      message: `ADVERTENCIA: El producto "${nombre}" está vencido (Fecha de vencimiento: ${fechaVencimiento.toLocaleDateString()})`,
                      isWarning: true
                  });
              }
          }

          // Insertar detalle de venta
          await client.query(
              `INSERT INTO productventa (cod_venta, cod_producto, precio_venta, cantidad_venta, metodo_pago, sector, fecha_salida)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [codigo_venta, codigo_producto, precio_unitario, cantidad, metodo_pago, sector, fechaVenta]
          );

          // Descontar del inventario (método FIFO)
          let cantidadRestante = cantidad;
          const lotesResult = await client.query(
              `SELECT cod_proveedor, cantidad 
              FROM proveproduct 
              WHERE cod_producto = $1 AND cantidad > 0
              ORDER BY fecha_entrada ASC
              FOR UPDATE`,
              [codigo_producto]
          );

          for (const lote of lotesResult.rows) {
              if (cantidadRestante <= 0) break;

              const cantidadADescontar = Math.min(lote.cantidad, cantidadRestante);
              
              await client.query(
                  `UPDATE proveproduct 
                  SET cantidad = cantidad - $1 
                  WHERE cod_proveedor = $2 AND cod_producto = $3`,
                  [cantidadADescontar, lote.cod_proveedor, codigo_producto]
              );

              cantidadRestante -= cantidadADescontar;
          }
      }

      await client.query('COMMIT');
      return res.json({ 
          success: true, 
          message: 'Venta registrada correctamente',
          codigo_venta: codigo_venta
      });

  } catch (error) {
      if (client) {
          try {
              await client.query('ROLLBACK');
          } catch (rollbackError) {
              console.error('Error en rollback:', rollbackError);
          }
      }
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
      if (client) {
          try {
              client.release();
          } catch (releaseError) {
              console.error('Error al liberar cliente:', releaseError);
          }
      }
  }
});

// API para obtener ventas (JSON)
router.get('/api/ventas', isLoggedIn, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT v.cod_venta, pv.fecha_salida, pv.cod_producto, pv.precio_venta, 
                   pv.cantidad_venta, pv.metodo_pago, pv.sector
            FROM venta v
            JOIN productventa pv ON v.cod_venta = pv.cod_venta
            ORDER BY pv.fecha_salida ASC
        `);
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al obtener ventas:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener ventas',
            error: error.message 
        });
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error al liberar cliente:', releaseError);
            }
        }
    }
});

// Ruta para obtener el empleado logueado - Modificado para enviar datos más claros
router.get('/empleados/api/empleados', isLoggedIn, async (req, res) => {
    try {
        const empleado = req.user;  // El empleado que está autenticado
        
        // Verificar que el empleado tenga el código necesario
        if (!empleado || !empleado.cod_empleado) {
            return res.status(400).json({ 
                success: false, 
                message: "No se pudo obtener el código del empleado" 
            });
        }

        res.json({
            success: true,
            data: [{
                cod_empleado: empleado.cod_empleado,
                nombre: empleado.nombre,
                apellido: empleado.apellido
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
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT 
        p.cod_producto, 
        p.nombre, 
        p.marca, 
        p.fechavencimiento, 
        p.precio_compra, 
        p.cantidad,
        p.sector
      FROM producto p
      WHERE p.fechavencimiento IS NULL OR p.fechavencimiento >= CURRENT_DATE
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  } finally {
    if (client) {
        try {
            client.release();
        } catch (releaseError) {
            console.error('Error al liberar cliente:', releaseError);
        }
    }
  }
});

export { router };