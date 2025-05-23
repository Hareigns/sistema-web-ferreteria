import express from 'express';
import pool from '../database.js';
import { database } from '../keys.js';


const router = express.Router();

// Ruta para mostrar la vista
router.get('/add', (req, res) => {
    res.render('reportes/add');
});


// Ruta para manejar el reporte de ventas
router.post('/ventas', async (req, res) => {
    try {
        const { filtro } = req.body;
        
        // Validar que venga el filtro
        if (!filtro) {
            return res.status(400).json({ 
                success: false, 
                message: 'El parámetro "filtro" es requerido' 
            });
        }

        // Ejecutar el stored procedure
        const [results] = await pool.query('CALL sp_reporte_ventas(?)', [filtro]);
        
        // MySQL devuelve los resultados en un array de arrays
        // Tomamos el primer conjunto de resultados
        const data = results[0] || [];
        
        res.json(data);
    } catch (error) {
        console.error('Error en /reportes/ventas:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error al generar el reporte' 
        });
    }
});


// Ruta para el reporte de productos
router.get('/productos', async (req, res) => {
    try {
        // Ejecutar el stored procedure
        const [results] = await pool.query('CALL ReporteProductosVendidos()');
        
        // MySQL devuelve múltiples conjuntos de resultados para procedimientos
        // Necesitamos el primer conjunto que contiene los datos del reporte
        const data = results[0] || [];
        
        if (!Array.isArray(data)) {
            throw new Error('Formato de respuesta inesperado de la base de datos');
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error en /reportes/productos:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error al generar el reporte de productos' 
        });
    }
});



export { router };