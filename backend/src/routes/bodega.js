import express from "express";
const router = express.Router();

// Rutas de bodega
router.get('/', (req, res) => {
    res.send('Ruta de bodega');
});

export { router }; // <-- Exportación nombrada