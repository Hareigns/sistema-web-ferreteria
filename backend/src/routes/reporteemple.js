import express from "express";
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Constantes para validaciones
const VALID_FILTERS = ['diario', 'semanal', 'mensual'];
const DEFAULT_ERROR_MESSAGE = 'Error al procesar la solicitud';

// Middleware para manejo de errores centralizado
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/add', (req, res) => {
    res.render('reporteemple/add', { 
        title: 'Reportes Empleado',
        // other data as needed
    });
});

// Ruta para manejar el reporte de ventas
router.post('/ventas', asyncHandler(async (req, res) => {
    const { filtro, fecha, empleadoId } = req.body;
    
    // Validación mejorada
    if (!VALID_FILTERS.includes(filtro)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Parámetro "filtro" inválido. Valores aceptados: diario, semanal, mensual'
        });
    }

    if (!fecha) {
        return res.status(400).json({ 
            success: false, 
            message: 'Parámetro "fecha" es requerido'
        });
    }

    console.log(`Solicitud recibida - Filtro: ${filtro}, Fecha: ${fecha}, EmpleadoID: ${empleadoId}`);

    let client;
    try {
        client = await pool.connect();
        
        // Llamar a la función de PostgreSQL (no procedimiento almacenado)
        const result = await client.query(
            'SELECT * FROM sp_reporte_ventas_empleado($1, $2, $3)', 
            [filtro, fecha, empleadoId]
        );
        
        console.log(`Resultados obtenidos: ${result.rows?.length || 0} registros`);
        
        const data = Array.isArray(result.rows) ? result.rows : [];
        res.json(data);
        
    } catch (error) {
        console.error('Error en /reporteemple/ventas:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) client.release();
    }
}));

// Middleware para manejo de errores no capturados
router.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        success: false,
        message: DEFAULT_ERROR_MESSAGE
    });
});

export { router };