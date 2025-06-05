import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";
import pool from '../database.js';

// Ruta principal de bodega
router.get('/list', (req, res) => {
    try {
        res.render('bodega/list');
    } catch (err) {
        console.error('Error al renderizar vista:', err);
        res.status(500).send('Error interno al cargar la vista');
    }
});


router.get('/api/reporte', async (req, res) => {
    const { sector, periodo = 'todos', search } = req.query;

    try {
        // Si no hay ningún filtro, obtener todos los productos activos
        if (!sector && !search && periodo === 'todos') {
            const [results] = await pool.query(`
    SELECT 
        p.Cod_Producto,
        p.Nombre,
        p.Marca,
        pp.Fecha_Entrada AS FechaEntrada,
        pp.Cantidad,
        p.FechaVencimiento,
        p.Sector,
        p.Descripcion  -- Añadir este campo
    FROM 
        Producto p
    JOIN 
        ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
    WHERE 
        p.Estado = 'Activo'
    ORDER BY pp.Fecha_Entrada DESC`);
                
            return res.json({
                success: true,
                data: results
            });
        }
        
        // Usar el SP para búsquedas con filtros
        const [results] = await pool.query(
            'CALL sp_reporte_bodega(?, ?, ?)', 
            [
                sector || null,
                periodo,
                search || null
            ]
        );
        
        return res.json({
            success: true,
            data: results[0] || []
        });

    } catch (error) {
        console.error('Error en reporte de bodega:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte',
            error: error.message
        });
    }
});

// Función auxiliar para construir condición de período
function getPeriodCondition(periodo) {
    switch(periodo) {
        case 'diario':
            return 'AND pp.Fecha_Entrada >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        case 'semanal':
            return 'AND pp.Fecha_Entrada >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        case 'mensual':
            return 'AND pp.Fecha_Entrada >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
        default:
            return '';
    }
}

export { router };