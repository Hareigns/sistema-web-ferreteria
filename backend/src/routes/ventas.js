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
    codigo_empleado, 
    
    detalles_venta, // Puede ser un array de productos con cantidades y precios
  } = req.body;

  console.log("Datos recibidos en el servidor (ventas):", req.body);

  // Validaciones básicas
  if (!codigo_empleado || !detalles_venta) {
    return res.status(400).json({ 
      success: false, 
      message: "Datos incompletos" 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insertar la venta sin especificar el Cod_Venta (será auto incrementado)
    const [resultVenta] = await connection.query(
      `INSERT INTO Venta (Cod_Empleado)
       VALUES (?)`,
      [codigo_empleado]
    );

    const codigo_venta = resultVenta.insertId; // El ID auto incrementado se obtiene aquí

    // Insertar detalles de la venta
    for (const detalle of detalles_venta) {
      const { codigo_producto, cantidad, precio_unitario, metodo_pago, sector } = detalle;
      
      if (!codigo_producto || !cantidad || !precio_unitario || !metodo_pago || !sector) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Datos de detalles incompletos"
        });
      }

      await connection.query(
        `INSERT INTO ProductVenta (Cod_Venta, Cod_Producto, Precio_Venta, Cantidad_Venta, Metodo_Pago, Sector, Fecha_salida)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [codigo_venta, codigo_producto, precio_unitario, cantidad, metodo_pago, sector, new Date().toISOString().split('T')[0]]
      );
    }

    await connection.commit();
    
    return res.json({ 
      success: true, 
      message: 'Venta registrada correctamente',
      codigo: codigo_venta
    });

  } catch (error) {
    await connection?.rollback();
    console.error("Error al registrar la venta:", error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error al registrar la venta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Ruta para obtener el empleado logueado
router.get('/empleados/api/empleados', isLoggedIn, async (req, res) => {
    try {
        const empleado = req.user;  // El empleado que está autenticado está disponible en req.user
        res.json({
            success: true,
            data: [empleado]  // Solo enviar el empleado logueado
        });
    } catch (error) {
        console.error("Error al obtener el empleado:", error);
        res.status(500).json({ success: false, message: "Error en la solicitud" });
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
        p.Fecha_Vencimiento, 
        pv.Sector, 
        p.Precio_Compra, 
        p.Cantidad
      FROM Producto p
      JOIN ProductVenta pv ON p.Cod_Producto = pv.Cod_Producto
    `);

    console.log("Datos enviados desde la API:", productos);

    res.json({ success: true, data: productos });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  }
});

export { router };