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

// Agregar venta
router.post("/add", isLoggedIn, async (req, res) => {
  const { codigo_producto, cantidad, metodo_pago, precio_venta, sector, fecha_venta } = req.body;

  const validationErrors = validateVentaData(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, errors: validationErrors });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insertar en la tabla de Venta
    const ventaData = { Fecha_Venta: fecha_venta || new Date().toISOString().split('T')[0] };  // Si no hay fecha, tomamos la fecha actual
    const [resultVenta] = await connection.query('INSERT INTO Venta SET ?', [ventaData]);

    // Obtener el ID generado para la venta
    const nuevoCodVenta = resultVenta.insertId;

    // Insertar en la tabla ProductVenta
    const productVentaData = {
      Cod_Producto: codigo_producto,
      Cod_Venta: nuevoCodVenta,
      Metodo_Pago: metodo_pago,
      Precio_Venta: precio_venta,
      Cantidad_Venta: cantidad,
      Sector: sector,
      Fecha_salida: fecha_venta || new Date().toISOString().split('T')[0]
    };
    await connection.query('INSERT INTO ProductVenta SET ?', [productVentaData]);

    await connection.commit();

    res.json({ success: true, message: "Venta registrada correctamente", codigo_venta: nuevoCodVenta });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error al agregar venta:", error);
    res.status(500).json({ success: false, error: 'Error al agregar venta' });
  } finally {
    if (connection) connection.release();
  }
});

// API para obtener ventas (JSON)
router.get('/api/ventas', isLoggedIn, async (req, res) => {
    try {
      // Realizar la consulta con el campo correcto
      const [ventas] = await pool.query(`
        SELECT v.Cod_Venta, pv.Fecha_Salida, pv.Cod_Producto, pv.Precio_Venta, pv.Cantidad_Venta, pv.Metodo_Pago, pv.Sector
        FROM Venta v
        JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      `);
  
      res.json({ success: true, data: ventas });
    } catch (error) {
      console.error("Error al obtener ventas:", error); // Muestra el error completo en la consola
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