import express from 'express';
import { isNotLoggedIn } from '../lib/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/', isNotLoggedIn, async (req, res) => {
    try {
        // Llamar a la función de PostgreSQL
        const result = await pool.query('SELECT * FROM topproductosporsectorconprecio()');
        
        const productosDestacados = result.rows;
    
        // Agrupar productos por sector
        const productosPorSector = {};
        
        if (productosDestacados && productosDestacados.length > 0) {
            productosDestacados.forEach(producto => {
                // PostgreSQL devuelve los nombres en minúsculas
                if (!productosPorSector[producto.sector]) {
                    productosPorSector[producto.sector] = [];
                }
                
                // Convertir cantidadvendida a número y formatear
                const cantidadVendida = parseFloat(producto.cantidadvendida) || 0;
                
                // Mapear los campos de minúsculas a mayúsculas para mantener compatibilidad
                productosPorSector[producto.sector].push({
                    Sector: producto.sector,
                    Cod_Producto: producto.cod_producto,
                    Nombre_Producto: producto.nombre_producto,
                    CantidadVendida: cantidadVendida,
                    PrecioPromedio: producto.preciopromedio,
                    TotalVendido: producto.totalvendido,
                    Icono: producto.icono,
                    // Propiedad formateada para la vista
                    CantidadVendidaFormatted: cantidadVendida.toFixed(0)
                });
            });
        }

        res.render('index', { 
            title: 'Inicio',
            productosPorSector: productosPorSector || {}
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