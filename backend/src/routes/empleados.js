import express from "express";
const router = express.Router();

// Rutas de empleados
router.get('/', (req, res) => {
    res.send('Ruta de empleados');
});

export { router }; // <-- Exportación nombrada