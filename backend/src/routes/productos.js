import express from 'express';
import pool from '../database.js';
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Datos de sectores
const SECTORES = [
  "Herramientas manuales", "Herramientas eléctricas", 
  "Materiales de construcción", "Pinturas o accesorios",
  "Tuberías y plomería", "Electricidad e iluminación",
  "Seguridad industrial", "Productos de ferretería general"
];

// Mostrar formulario de añadir Producto
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    res.render("productos/add", {
      title: "Agregar Producto",
      sectores: SECTORES,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al cargar formulario:", error);
    req.flash("error", "Error al cargar el formulario");
    res.redirect("/productos");
  }
});

// API para guardar productos
router.post("/api/productos", isLoggedIn, async (req, res) => {
  const { 
    codigo_producto, 
    nombre, 
    marca, 
    fecha_vencimiento, 
    sector, 
    codigo_proveedor, 
    precio_compra, 
    cantidad,
    fecha_entrada
  } = req.body;

  // Validaciones
  if (!codigo_producto || !nombre || !codigo_proveedor) {
    return res.status(400).json({ 
      success: false, 
      message: "Datos incompletos" 
    });
  }

  // Asegurar que fecha_entrada tenga un valor válido
  const fechaEntradaValida = fecha_entrada || new Date().toISOString().split('T')[0];

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verificar si el producto existe
    const [productoExistente] = await connection.query(
      'SELECT Cod_Producto FROM Producto WHERE Cod_Producto = ?',
      [codigo_producto]
    );

    if (productoExistente.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El código de producto ya existe"
      });
    }

    // Insertar producto
    await connection.query(
      `INSERT INTO Producto (Cod_Producto, Nombre, Marca, FechaVencimiento, Sector)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo_producto, nombre, marca, fecha_vencimiento || null, sector]
    );

    // Insertar relación con proveedor
    await connection.query(
      `INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo_proveedor, codigo_producto, fechaEntradaValida, precio_compra, cantidad]
    );

    await connection.commit();
    
    return res.json({ 
      success: true, 
      message: 'Producto registrado correctamente',
      codigo: codigo_producto
    });

  } catch (error) {
    await connection?.rollback();
    console.error("Error al registrar producto:", error);
    
    let message = 'Error al registrar el producto';
    if (error.code === 'ER_DUP_ENTRY') {
      message = 'El código de producto ya existe';
    } else if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
      message = 'Formato de fecha incorrecto';
    }

    return res.status(500).json({ 
      success: false, 
      message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection?.release();
  }
});

// Ruta para obtener productos
// Ruta para obtener todos los productos
router.get("/api/productos", isLoggedIn, async (req, res) => {
    try {
      const [productos] = await pool.query(`
        SELECT p.*, pp.Precio as Precio_Compra, pp.Cantidad 
        FROM Producto p
        JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
      `);
      
      res.json({
        success: true,
        data: productos
      });
    } catch (error) {
      console.error("Error al obtener productos:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener productos"
      });
    }
  });


// Ruta para obtener proveedores
router.get("/api/proveedores", isLoggedIn, async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT Cod_Proveedor, Nombre, Apellido, Sector FROM Proveedor';
    const params = [];
    
    if (sector) {
      query += ' WHERE Sector = ?';
      params.push(sector);
    }
    
    const [proveedores] = await pool.query(query, params);
    res.json({
      success: true,
      data: proveedores
    });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener proveedores"
    });
  }
});

export { router };