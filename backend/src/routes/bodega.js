import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";

// Definir rutas
router.get("/add", isLoggedIn,  (req, res) => {
    res.render("bodega/list");
});


// Exportar el router
export { router }; // Exportación nombrada