import express from 'express';
import { isNotLoggedIn } from '../lib/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/', isNotLoggedIn, async (req, res) => {
    try {
        // Llamar al procedimiento almacenado
        const [results] = await pool.query('CALL TopProductosPorSectorConPrecio()');
        
        // Los procedimientos almacenados pueden devolver múltiples conjuntos de resultados
        // Normalmente el primer array contiene los datos que necesitamos
        const productosDestacados = Array.isArray(results[0]) ? results[0] : results;
    
        
        // Agrupar productos por sector
        const productosPorSector = {};
        
        if (productosDestacados && productosDestacados.length > 0) {
            productosDestacados.forEach(producto => {
                if (!productosPorSector[producto.Sector]) {
                    productosPorSector[producto.Sector] = [];
                }
                productosPorSector[producto.Sector].push({
                    ...producto,
                    CantidadVendida: producto.CantidadVendida.toFixed(0) // Formatear a entero
                });
            });
        }

        res.render('index', { 
            title: 'Inicio',
            productosPorSector: productosPorSector || {} // Asegurar que siempre sea un objeto
        });
    } catch (err) {
        console.error('Error al obtener productos destacados:', err);
        res.render('index', { 
            title: 'Inicio',
            productosPorSector: {} 
        });
    }
});

export default router;