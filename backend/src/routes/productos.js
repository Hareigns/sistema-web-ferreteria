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
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ success: false, message: "No se recibieron productos." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

     for (const producto of productos) {
        const { 
            codigo_producto, nombre, marca, fecha_vencimiento, 
            sector, codigo_proveedor, precio_compra, 
            cantidad, fecha_entrada, ubicacion, descripcion 
        } = producto;

        // Usar ubicacion si descripcion no está definida
        const descripcionFinal = descripcion || ubicacion || null;

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
        throw new Error(`Producto con código ${codigo_producto} ya existe`);
      }

      await connection.query(
            `INSERT INTO Producto (Cod_Producto, Nombre, Marca, FechaVencimiento, Sector, Descripcion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [codigo_producto, nombre, marca, fechaVencimientoValida, sector, descripcionFinal]
        );

      await connection.query(
        `INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad)
         VALUES (?, ?, ?, ?, ?)`,
        [codigo_proveedor, codigo_producto, fechaEntradaValida, precio_compra, cantidad]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Productos registrados exitosamente" });

  } catch (error) {
    await connection?.rollback();
    console.error("Error al registrar productos:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection?.release();
  }
});

// Ruta para obtener todos los productos (MODIFICADA CON ORDER BY)
router.get("/api/productos", isLoggedIn, async (req, res) => {
  try {
    const [productos] = await pool.query(`
      SELECT 
        p.Cod_Producto, 
        p.Nombre, 
        p.Marca, 
        p.FechaVencimiento, 
        p.Sector, 
        p.Descripcion,
        pp.Precio AS Precio_Compra, 
        pp.Cantidad
      FROM Producto p
      JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
      ORDER BY p.Cod_Producto ASC
    `);

    res.json({ success: true, data: productos });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  }
});


// Ruta para obtener un producto específico por su código (VERSIÓN CORREGIDA)
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
        p.Descripcion,
        pp.Precio AS Precio_Compra, 
        pp.Cantidad,
        pp.Fecha_Entrada,
        pp.Cod_Proveedor,
        pr.Nombre AS ProveedorNombre,
        pr.Apellido AS ProveedorApellido
      FROM Producto p
      JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
      JOIN Proveedor pr ON pp.Cod_Proveedor = pr.Cod_Proveedor
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

// Ruta para actualizar un producto
router.put("/api/productos/:codigo", isLoggedIn, async (req, res) => {
    const { codigo } = req.params;
    const { precio_compra, cantidad, descripcion, actualizar_fecha } = req.body;

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

        // Actualizar descripción (ubicación) en la tabla Producto
        await connection.query(
            `UPDATE Producto
             SET Descripcion = ?
             WHERE Cod_Producto = ?`,
            [descripcion, codigo]
        );

        // Actualizar precio y cantidad (y fecha si es necesario)
        if (actualizar_fecha) {
            await connection.query(
                `UPDATE ProveProduct
                 SET Precio = ?, Cantidad = ?, Fecha_Entrada = CURRENT_DATE()
                 WHERE Cod_Producto = ?`,
                [precio_compra, cantidad, codigo]
            );
        } else {
            await connection.query(
                `UPDATE ProveProduct
                 SET Precio = ?, Cantidad = ?
                 WHERE Cod_Producto = ?`,
                [precio_compra, cantidad, codigo]
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
            message: "Error al actualizar producto" 
        });
    } finally {
        connection?.release();
    }
});

router.get("/api/ubicaciones", isLoggedIn, async (req, res) => {
    try {
        const [ubicaciones] = await pool.query(
            "SELECT DISTINCT Descripcion FROM Producto WHERE Descripcion IS NOT NULL AND Descripcion != ''"
        );
        
        res.json({
            success: true,
            data: ubicaciones.map(u => u.Descripcion)
        });
    } catch (error) {
        console.error("Error al obtener ubicaciones:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener ubicaciones"
        });
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


// Ruta para obtener proveedores (VERSIÓN CORREGIDA)
router.get("/api/proveedores", isLoggedIn, async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT Cod_Proveedor, Nombre, Apellido, Sector FROM Proveedor WHERE Estado = "Activo"';
    const params = [];
    
    if (sector) {
      query += ' AND Sector = ?';
      params.push(sector);
    }
    
    const [proveedores] = await pool.query(query, params);
    
    // Formatear la respuesta como espera el frontend
    res.json({
      success: true,
      data: proveedores.map(p => ({
        codigo_proveedor: p.Cod_Proveedor,
        nombre: `${p.Nombre} ${p.Apellido}`,
        sector: p.Sector
      }))
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