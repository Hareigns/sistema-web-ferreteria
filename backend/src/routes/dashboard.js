import express from 'express';
const router = express.Router();

// Definir rutas
router.get('/', (req, res) => {
    res.send('Lista de dashboard');
});

// Exportar el router
export { router }; // Exportación nombrada