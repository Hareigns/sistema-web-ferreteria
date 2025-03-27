import express from 'express';
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";


const router = express.Router();


// Ruta para agregar productos
router.post("/api/productos", isLoggedIn, async (req, res) => {
    const { codigo_producto, nombre, marca, fecha_vencimiento, sector, codigo_proveedor, precio_compra, cantidad } = req.body;

    const precio = parseFloat(precio_compra);
    const cantidadProducto = parseInt(cantidad);

    if (isNaN(precio) || isNaN(cantidadProducto)) {
        return res.status(400).json({ success: false, message: "Precio o cantidad inválidos" });
    }

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Insertar en la tabla Producto
            const resultProducto = await client.query(
                `INSERT INTO Producto (Cod_Producto, Nombre, Marca, FechaVencimiento, Sector)
                 VALUES ($1, $2, $3, $4, $5) RETURNING Cod_Producto`,
                [codigo_producto, nombre, marca, fecha_vencimiento, sector]
            );
            const codProducto = resultProducto.rows[0].Cod_Producto;

            // Insertar en la tabla ProveProduct
            await client.query(
                `INSERT INTO ProveProduct (Cod_Proveedor, Cod_Producto, Fecha_Entrada, Precio, Cantidad)
                 VALUES ($1, $2, $3, $4, $5)`,
                [codigo_proveedor, codProducto, new Date(), precio, cantidadProducto]
            );

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Producto ingresado correctamente' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("❌ Error al insertar producto:", error);
            res.status(500).json({ success: false, message: 'Error al guardar el producto' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("❌ Error en la transacción:", error);
        res.status(500).json({ success: false, message: 'Error en la base de datos' });
    }
});

// Definir rutas
router.get("/add", isLoggedIn,  (req, res) => {
    res.render("productos/add");
});

// Mostrar formulario de añadir Producto
router.get("/add", isLoggedIn, async (req, res) => {
    console.log("📌 Endpoint /add ejecutado");

    try {
        const sectores = [
            "Herramientas manuales", "Herramientas eléctricas", "Materiales de construcción",
            "Pinturas o accesorios", "Tuberías y plomería", "Electricidad e iluminación",
            "Seguridad industrial", "Productos de ferretería general"
        ];

        console.log("📌 Sectores disponibles en backend:", sectores);

        res.render("productos/add", {
            title: "Agregar Producto",
            sectores,
            messages: req.flash()
        });

    } catch (error) {
        console.error("❌ Error al obtener sectores:", error);
        req.flash("error", "Error al cargar sectores");
        res.redirect("/productos");
    }
});


// Exportar el router
export { router }; // Exportación nombrada