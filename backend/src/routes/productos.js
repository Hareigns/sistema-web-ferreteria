import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";

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




// Ruta para obtener proveedores por sector
/* router.get("/api/proveedores/:sector", async (req, res) => {
    const { sector } = req.params;

    try {
        const [proveedores] = await pool.query(
            `SELECT p.Cod_Proveedor, p.Nombre 
             FROM Proveedor p
             JOIN ProveProduct pp ON p.Cod_Proveedor = pp.Cod_Proveedor
             JOIN Producto pr ON pp.Cod_Producto = pr.Cod_Producto
             WHERE pr.Sector = ?`,
            [sector]
        );

        if (proveedores.length > 0) {
            res.json({ success: true, data: proveedores });
        } else {
            res.json({ success: false, message: "No hay proveedores disponibles." });
        }
    } catch (error) {
        console.error("Error al obtener proveedores:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});
*/

// Exportar el router
export { router }; // Exportación nombrada