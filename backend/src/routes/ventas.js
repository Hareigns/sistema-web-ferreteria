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

// Ruta para guardar la venta
router.post("/api/ventas", isLoggedIn, async (req, res) => {
  const { 
    codigo_empleado, 
    detalles_venta,
    estado_venta = 'Completada' // Valor por defecto
  } = req.body;

  if (!codigo_empleado || !detalles_venta || detalles_venta.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Datos incompletos: empleado y productos son requeridos" 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Llamada al procedimiento almacenado
    const [result] = await connection.query(
      `CALL RegistrarVenta(?, ?, ?)`,
      [codigo_empleado, JSON.stringify(detalles_venta), estado_venta]
    );

    // El valor de `codigo_venta` se obtiene desde el resultado
    const codigo_venta = result[0].codigo_venta;

    return res.json({
      success: true,
      message: 'Venta registrada correctamente',
      codigo_venta: codigo_venta,  // Devuelve el código de venta
    });

  } catch (error) {
    console.error("Error detallado:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error al registrar la venta",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection?.release();
  }
});



/*router.post("/api/reporteventas", async (req, res) => {
  const { cod_venta, monto_total } = req.body;

  if (!cod_venta || !monto_total) {
    return res.status(400).json({ message: "Datos incompletos para ReporteVentas" });
  }

  try {
    const connection = await pool.getConnection();

    const [reporte] = await connection.query(`
      INSERT INTO Reportes (Tipo_Reporte, Fecha_Reporte)
      VALUES ('Venta', NOW())
    `);

    const cod_reporte = reporte.insertId;

    await connection.query(`
      INSERT INTO ReporteVentas (Cod_Reporte, Cod_Venta, Monto_Total)
      VALUES (?, ?, ?)`, [cod_reporte, cod_venta, monto_total]);

    res.json({ success: true, message: "Reporte guardado" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al guardar reporte", error: err.message });
  }
});*/


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
