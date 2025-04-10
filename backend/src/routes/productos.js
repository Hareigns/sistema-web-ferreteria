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


router.post("/api/productos", isLoggedIn, async (req, res) => {
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ success: false, message: "No se recibieron productos." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const tipoReporte = 'Productos'; // Según el tipo de reporte, puede ser 'Ventas' o 'Productos'
    const periodo = 'Diario'; // Este es solo un ejemplo, puedes ajustarlo según necesites

    // Insertamos un nuevo reporte
    const [reporteResult] = await connection.query(
      `INSERT INTO Reportes (Tipo_Reporte, Periodo, Fecha_Generacion)
       VALUES (?, ?, NOW())`,
      [tipoReporte, periodo]
    );

    const codigo_reporte = reporteResult.insertId;

    for (const producto of productos) {
      const { 
        codigo_producto, nombre, marca, fecha_vencimiento, 
        sector, codigo_proveedor, precio_compra, 
        cantidad, fecha_entrada 
      } = producto;

      if (!codigo_producto || !nombre || !codigo_proveedor) {
        throw new Error("Producto con datos incompletos");
      }

      const fechaVencimientoValida = fecha_vencimiento || null;
      const fechaEntradaValida = fecha_entrada || new Date().toISOString().split('T')[0];

      const [productoExistente] = await connection.query(
        'SELECT Cod_Producto FROM Producto WHERE Cod_Producto = ?',
        [codigo_producto]
      );

      if (productoExistente.length > 0) {
        // Producto ya existe, actualizamos la cantidad en ProveProduct
        await connection.query(
          `UPDATE ProveProduct
           SET Cantidad = Cantidad + ?, Fecha_Entrada = ?
           WHERE Cod_Proveedor = ? AND Cod_Producto = ?`,
          [cantidad, fechaEntradaValida, codigo_proveedor, codigo_producto]
        );
      } else {
        // Si el producto no existe, lo insertamos en Producto y ProveProduct
        await connection.query(
          `INSERT INTO Producto (Cod_Producto, Nombre, Marca, FechaVencimiento, Sector)
           VALUES (?, ?, ?, ?, ?)`,
          [codigo_producto, nombre, marca, fechaVencimientoValida, sector]
        );

        await connection.query(
          `INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad)
           VALUES (?, ?, ?, ?, ?)`,
          [codigo_proveedor, codigo_producto, fechaEntradaValida, precio_compra, cantidad]
        );
      }

      // Insertamos los registros en ReporteProductos
      const tipoAnalisis = 'Producto no vendido'; // Este puede cambiar según el tipo de análisis que quieras hacer
      await connection.query(
        `INSERT INTO ReporteProductos (Cod_Reporte, Cod_Producto, Cantidad_Vendida, Tipo_Analisis)
         VALUES (?, ?, ?, ?)`,
        [codigo_reporte, codigo_producto, cantidad, tipoAnalisis]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Productos registrados y reportados exitosamente" });

  } catch (error) {
    await connection?.rollback();
    console.error("Error al registrar productos:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection?.release();
  }
});





// Ruta para obtener un producto específico por su código
router.get("/api/productos/:codigo", isLoggedIn, async (req, res) => {
  try {
    const { codigo } = req.params;
    
    const [producto] = await pool.query(`
      SELECT 
        p.Cod_Producto, 
        p.Nombre, 
        p.Marca, 
        p.FechaVencimiento, 
        p.Sector, 
        pp.Precio AS Precio_Compra, 
        pp.Cantidad,
        pp.Fecha_Entrada,
        pp.Cod_Proveedor
      FROM Producto p
      JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
      WHERE p.Cod_Producto = ?
    `, [codigo]);

    if (producto.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    res.json({ 
      success: true, 
      data: producto[0] 
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener producto" 
    });
  }
});



router.put("/api/productos/:codigo", isLoggedIn, async (req, res) => {
  const { codigo } = req.params;
  const { precio_compra, cantidad } = req.body;

  // Validaciones mínimas
  if (typeof precio_compra !== 'number' || typeof cantidad !== 'number') {
    return res.status(400).json({ 
      success: false, 
      message: "Precio y cantidad deben ser números" 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Actualizamos precio y cantidad en ProveProduct
    const updateResult = await connection.query(
      `UPDATE ProveProduct
       SET Precio = ?, Cantidad = ?
       WHERE Cod_Producto = ?`,
      [precio_compra, cantidad, codigo]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error(`Producto con código ${codigo} no encontrado en ProveProduct.`);
    }

    // 2. Obtenemos el último reporte
    const [ultimoReporte] = await connection.query(
      `SELECT Cod_Reporte FROM Reportes ORDER BY Cod_Reporte DESC LIMIT 1`
    );
    
    if (ultimoReporte.length === 0) {
      throw new Error("No hay reportes existentes");
    }
    
    const codReporte = ultimoReporte[0].Cod_Reporte;

    // 3. Verificación más robusta de existencia
    const [existeRegistro] = await connection.query(
      `SELECT COUNT(*) as count FROM ReporteProductos 
       WHERE Cod_Producto = ? AND Cod_Reporte = ?`,
      [codigo, codReporte]
    );

    if (existeRegistro[0].count > 0) {
      // Actualizar si existe
      await connection.query(
        `UPDATE ReporteProductos
         SET Cantidad_Vendida = ?, Tipo_Analisis = 'Producto no vendido'
         WHERE Cod_Producto = ? AND Cod_Reporte = ?`,
        [cantidad, codigo, codReporte]
      );
    } else {
      // Insertar solo si no existe
      await connection.query(
        `INSERT INTO ReporteProductos (Cod_Reporte, Cod_Producto, Cantidad_Vendida, Tipo_Analisis)
         VALUES (?, ?, ?, 'Producto no vendido')
         ON DUPLICATE KEY UPDATE Cantidad_Vendida = VALUES(Cantidad_Vendida)`,
        [codReporte, codigo, cantidad]
      );
    }

    await connection.commit();
    res.json({ 
      success: true, 
      message: "Producto actualizado correctamente" 
    });
  } catch (error) {
    await connection?.rollback();
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error al actualizar producto" 
    });
  } finally {
    connection?.release();
  }
});




// Ruta para obtener todos los productos
router.get("/api/productos", isLoggedIn, async (req, res) => {
  try {
    const [productos] = await pool.query(`
      SELECT 
        p.Cod_Producto, 
        p.Nombre, 
        p.Marca, 
        p.FechaVencimiento, 
        p.Sector, 
        pp.Precio AS Precio_Compra, 
        pp.Cantidad
      FROM Producto p
      JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
    `);

    //console.log("Datos enviados desde la API:", productos);

    res.json({ success: true, data: productos });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
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