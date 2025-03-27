
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

// Exportar el router
export { router }; // Exportación nombrada