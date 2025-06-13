import express from "express";
import pool from "../database.js";

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
    const { filtro, fecha } = req.body;
    const empleadoId = req.user.Cod_Empleado; // Asumiendo que el ID del empleado está en req.user
    
    if (!empleadoId) {
        return res.status(403).json({ 
            success: false, 
            message: 'Acceso no autorizado' 
        });
    }
    
    // Validación mejorada
    if (!filtro || !VALID_FILTERS.includes(filtro)) {
        return res.status(400).json({ 
            success: false, 
            message: `Parámetro "filtro" inválido. Valores aceptados: ${VALID_FILTERS.join(', ')}` 
        });
    }

    if (!fecha) {
        return res.status(400).json({ 
            success: false, 
            message: `Parámetro "fecha" es requerido` 
        });
    }

    let connection;
     try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // Pasar el ID del empleado al procedimiento almacenado
        const [results] = await connection.query('CALL sp_reporte_ventas_empleado(?, ?, ?)', 
            [filtro, fechaParam, empleadoId]);
        await connection.commit();
        
        const data = Array.isArray(results[0]) ? results[0] : [];
        res.json(data);
        
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
router.post('/productos', async (req, res) => {
    try {
        // Obtener el ID del empleado desde la sesión
        const empleadoId = req.user.Cod_Empleado;
        
        if (!empleadoId) {
            return res.status(400).json({
                success: false,
                message: 'ID de empleado no disponible en la sesión'
            });
        }
        
        // Llamar al procedimiento almacenado
        const [results] = await pool.query(
            'CALL ReporteProductosVendidosEmpleado(?)', 
            [empleadoId]
        );

        // Procesar resultados (el procedimiento devuelve una sola tabla)
        const productos = results[0] || [];
        
        // Clasificar los productos por tipo
        const topProducts = productos.filter(p => p.Tipo === 'Más Vendido');
        const worstProducts = productos.filter(p => p.Tipo === 'Menos Vendido');
        const notSoldProducts = productos.filter(p => p.Tipo === 'No Vendido');

        res.json({
            success: true,
            data: {
                topProducts,
                worstProducts,
                notSoldProducts
            }
        });
    } catch (error) {
        console.error('Error en /reportes/productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar el reporte de productos',
            error: error.message
        });
    }
});

// Middleware para manejo de errores no capturados
router.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        success: false,
        message: DEFAULT_ERROR_MESSAGE
    });
});


export { router };
