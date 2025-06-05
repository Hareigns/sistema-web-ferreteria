import express from 'express';
import pool from '../database.js';

const router = express.Router();

// Constantes para validaciones
const VALID_FILTERS = ['diario', 'semanal', 'mensual'];
const DEFAULT_ERROR_MESSAGE = 'Error al procesar la solicitud';

// Middleware para manejo de errores centralizado
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Ruta para mostrar la vista
router.get('/add', (req, res) => {
    res.render('reportes/add');
});

// Ruta para manejar el reporte de ventas
// Ruta para manejar el reporte de ventas
router.post('/ventas', asyncHandler(async (req, res) => {
    const { filtro } = req.body;
    
    // Validación mejorada
    if (!filtro || !VALID_FILTERS.includes(filtro)) {
        return res.status(400).json({ 
            success: false, 
            message: `Parámetro "filtro" inválido. Valores aceptados: ${VALID_FILTERS.join(', ')}` 
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        // Usar transacción para mayor seguridad
        await connection.beginTransaction();
        
        const [results] = await connection.query('CALL sp_reporte_ventas(?)', [filtro]);
        await connection.commit();
        
        // Cambio clave: Devolver directamente el array de resultados
        const data = Array.isArray(results[0]) ? results[0] : [];
        res.json(data); // Solo enviamos el array de datos
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error en /reportes/ventas:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}));

// Ruta para el reporte de productos
router.get('/productos', asyncHandler(async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const [results] = await connection.query('CALL ReporteProductosVendidos()');
        await connection.commit();
        
        // Los resultados vienen en un solo array con el tipo incluido
        const allProducts = Array.isArray(results[0]) ? results[0] : [];
        
        // Separar por tipo según lo que indica el procedimiento almacenado
        const responseData = {
            topProducts: allProducts.filter(p => p.Tipo === 'Más Vendido'),
            worstProducts: allProducts.filter(p => p.Tipo === 'Menos Vendido'),
            notSoldProducts: allProducts.filter(p => p.Tipo === 'No Vendido')
        };

        res.json({
            success: true,
            data: responseData,
            metadata: {
                generatedAt: new Date().toISOString(),
                counts: {
                    topProducts: responseData.topProducts.length,
                    worstProducts: responseData.worstProducts.length,
                    notSoldProducts: responseData.notSoldProducts.length
                }
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error en /reportes/productos:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
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