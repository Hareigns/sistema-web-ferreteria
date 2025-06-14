import express from 'express';
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Ruta para la página principal del dashboard de empleado
router.get('/', isLoggedIn, (req, res) => {
    res.render('dashboardemple/add');
});

export default router;