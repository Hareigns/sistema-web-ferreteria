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
router.post('/ventas', asyncHandler(async (req, res) => {
    const { filtro, fecha } = req.body;
    
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
        
        // Procesar la fecha según el filtro
        let fechaParam = fecha;
        if (filtro === 'semanal') {
            // Extraer año y semana del formato YYYY-WWW
            const [year, week] = fecha.split('-W');
            fechaParam = `${year}-${week}`; // Formato: YYYY-WW (sin la W)
        }

        // Usar transacción para mayor seguridad
        await connection.beginTransaction();
        
        // Llamar al procedimiento almacenado con ambos parámetros
        const [results] = await connection.query('CALL sp_reporte_ventas(?, ?)', [filtro, fechaParam]);
        await connection.commit();
        
        // Devolver directamente el array de resultados
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

// Ruta para el reporte de productos detallado
router.get('/productos-detallado', asyncHandler(async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.query(`
            SELECT 
                p.Cod_Producto,
                p.Nombre,
                p.Marca,
                CONCAT(pr.Nombre, ' ', pr.Apellido) AS NombreProveedor,
                p.Sector,
                pp.Fecha_Entrada,
                pp.Cantidad,
                pp.Precio,
                p.FechaVencimiento
            FROM Producto p
            JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
            JOIN Proveedor pr ON pp.Cod_Proveedor = pr.Cod_Proveedor
            WHERE pr.Estado = 'Activo'
            ORDER BY p.Nombre, pp.Fecha_Entrada
        `);
        
        res.json({
            success: true,
            data: results,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: results.length
            }
        });
    } catch (error) {
        console.error('Error en /reportes/productos-detallado:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte detallado de productos'
        });
    } finally {
        if (connection) connection.release();
    }
}));

router.get('/ganancias', asyncHandler(async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Consulta SQL corregida para obtener datos de ganancias
        const [results] = await connection.query(`
            SELECT 
                pv.Cod_Venta,
                p.Cod_Producto,
                p.Nombre AS Nombre_Producto,
                pv.Cantidad_Venta,
                pp.Precio AS Costo_Unitario,
                ROUND(pp.Precio * 1.25, 2) AS Precio_Venta_Unitario, -- Añadido 25% al costo
                ROUND((pp.Precio * 1.25) - pp.Precio, 2) AS Margen_Unitario, -- Siempre positivo
                ROUND(((pp.Precio * 1.25) - pp.Precio) * pv.Cantidad_Venta, 2) AS Margen_Total, -- Siempre positivo
                ROUND((0.25 / pp.Precio * 100), 2) AS Porcentaje_Utilidad, -- Fijo 25%
                DATE_FORMAT(pp.Fecha_Entrada, '%d/%m/%Y') AS Fecha_Compra, -- Formato DD/MM/YYYY
                DATE_FORMAT(pv.Fecha_salida, '%d/%m/%Y') AS Fecha_Venta -- Formato DD/MM/YYYY
            FROM ProductVenta pv
            JOIN Producto p ON pv.Cod_Producto = p.Cod_Producto
            JOIN ProveProduct pp ON pv.Cod_Producto = pp.Cod_Producto
            WHERE p.Estado = 'Activo'
            ORDER BY pv.Cod_Venta, p.Nombre
        `);
        
        res.json({
            success: true,
            data: results,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: results.length
            }
        });
    } catch (error) {
        console.error('Error en /reportes/ganancias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte de ganancias',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}));

// Ruta para obtener lista de empleados
router.get('/empleados', asyncHandler(async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.query(`
            SELECT Cod_Empleado, Nombre, Apellido 
            FROM Empleado 
            WHERE Estado = 'Activo'
            ORDER BY Nombre, Apellido
        `);
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error en /reportes/empleados:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener la lista de empleados'
        });
    } finally {
        if (connection) connection.release();
    }
}));

// Ruta para ventas por empleado
router.post('/ventas-empleado', asyncHandler(async (req, res) => {
    const { filtro, fecha, empleado_id } = req.body;
    
    if (!filtro || !VALID_FILTERS.includes(filtro)) {
        return res.status(400).json({ 
            success: false, 
            message: `Parámetro "filtro" inválido. Valores aceptados: ${VALID_FILTERS.join(', ')}` 
        });
    }

    if (!fecha || !empleado_id) {
        return res.status(400).json({ 
            success: false, 
            message: `Parámetros "fecha" y "empleado_id" son requeridos` 
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const [results] = await connection.query('CALL sp_reporte_ventas_empleado(?, ?, ?)', [filtro, fecha, empleado_id]);
        await connection.commit();
        
        const data = Array.isArray(results[0]) ? results[0] : [];
        res.json(data);
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error en /reportes/ventas-empleado:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
}));

// Ruta para el reporte de bajas de productos
router.post('/bajas', asyncHandler(async (req, res) => {
    const { filtro, fecha } = req.body;
    
    let connection;
    try {
        connection = await pool.getConnection();
        
        let query = `
            SELECT 
                b.Id_Baja,
                b.Cod_Producto,
                p.Nombre AS Nombre_Producto,
                pr.Nombre AS Nombre_Proveedor,
                b.Fecha_Baja,
                b.Fecha_Salida_Baja,
                b.Cantidad,
                pp.Precio AS Precio_Compra,
                (b.Cantidad * pp.Precio) AS Subtotal,
                b.Motivo
            FROM BajasProductos b
            JOIN Producto p ON b.Cod_Producto = p.Cod_Producto
            JOIN Proveedor pr ON b.Cod_Proveedor = pr.Cod_Proveedor
            JOIN ProveProduct pp ON b.Cod_Producto = pp.Cod_Producto AND b.Cod_Proveedor = pp.Cod_Proveedor
        `;
        
        // Aplicar filtros
        if (filtro === 'mes' && fecha) {
            const [year, month] = fecha.split('-');
            query += ` WHERE YEAR(b.Fecha_Baja) = ${year} AND MONTH(b.Fecha_Baja) = ${month}`;
        } else if (filtro === 'anio' && fecha) {
            query += ` WHERE YEAR(b.Fecha_Baja) = ${fecha}`;
        }
        
        query += ' ORDER BY b.Fecha_Baja DESC';
        
        const [results] = await connection.query(query);
        
        res.json({
            success: true,
            data: results,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: results.length
            }
        });
        
    } catch (error) {
        console.error('Error en /reportes/bajas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte de bajas',
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