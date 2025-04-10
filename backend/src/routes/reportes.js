import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";

// Ruta para mostrar el formulario de reportes
router.get("/add", isLoggedIn, (req, res) => {
    try {
        res.render("reportes/add", {
            title: "Agregar Reporte",
            layout: "main"
        });
    } catch (error) {
        console.error("Error al cargar formulario de reportes:", error);
        res.status(500).render("500");
    }
});

export { router };