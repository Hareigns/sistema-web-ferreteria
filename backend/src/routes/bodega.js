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
    const { sector, periodo = 'todos' } = req.query;

    if (!sector) {
        return res.status(400).json({
            success: false,
            message: 'El parámetro sector es requerido'
        });
    }

    try {
        // Llamada directa al procedimiento almacenado
        const [results] = await pool.query(
            'CALL sp_reporte_bodega(?, ?)', 
            [sector, periodo]
        );
        
        // MySQL devuelve los resultados en un array peculiar
        const data = results[0] || [];
        
        console.log(`Productos obtenidos: ${data.length}`);
        
        return res.json({
            success: true,
            data: data.map(item => ({
                Cod_Producto: item.Cod_Producto,
                Nombre: item.Nombre,
                Marca: item.Marca,
                FechaEntrada: item.FechaEntrada,
                Cantidad: item.Cantidad,
                FechaVencimiento: item.FechaVencimiento,
                Sector: item.Sector
            }))
        });

    } catch (error) {
        console.error('Error en reporte de bodega:', {
            message: error.message,
            stack: error.stack,
            sqlMessage: error.sqlMessage
        });
        
        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte',
            error: error.message
        });
    }
});

export { router };