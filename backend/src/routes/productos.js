import express from 'express';
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Ruta para renderizar el formulario con los sectores
router.get("/add", isLoggedIn, async (req, res) => {
    try {
        const sectores = [
            "Herramientas manuales", "Herramientas eléctricas", "Materiales de construcción",
            "Pinturas o accesorios", "Tuberías y plomería", "Electricidad e iluminación",
            "Seguridad industrial", "Productos de ferretería general"
        ];
        res.render("productos/add", { title: "Agregar Producto", sectores, messages: req.flash() });
    } catch (error) {
        console.error("❌ Error al obtener sectores:", error);
        req.flash("error", "Error al cargar sectores");
        res.redirect("/productos");
    }
});

// Obtener productos (JSON)
router.get("/api/productos", isLoggedIn, async (req, res) => {
    try {
        const [productos] = await pool.query("SELECT * FROM Producto");
        res.json({ success: true, data: productos });
    } catch (error) {
        console.error("❌ Error al obtener productos:", error);
        res.status(500).json({ success: false, error: "Error al obtener productos" });
    }
});

// Ruta para insertar un nuevo producto
router.post('/api/productos', isLoggedIn, async (req, res) => {
    try {
        const { Nombre, Marca, FechaVencimiento, Sector, Cod_Proveedor, Fecha_Entrada, Precio, Cantidad } = req.body;

        // Insertar el producto en la tabla Producto
        const [result] = await pool.query(`
        INSERT INTO Producto (Nombre, Marca, FechaVencimiento, Sector) 
        VALUES (?, ?, ?, ?)`,
            [Nombre, Marca, FechaVencimiento, Sector]
        );

        const Cod_Producto = result.insertId; // Obtener el ID del producto insertado

        // Insertar en ProveProduct para vincular con el proveedor
        await pool.query(`
        INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad) 
        VALUES (?, ?, ?, ?, ?)`,
            [Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad]
        );

        res.json({ success: true, message: 'Producto agregado correctamente' });

    } catch (error) {
        console.error("Error al agregar producto:", error);
        res.status(500).json({ success: false, error: 'Error al agregar producto' });
    }
});



// Exportar el router
export { router };
