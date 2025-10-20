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

    let client;
    try {
        client = await pool.connect();
        
        // Usar transacción para mayor seguridad
        await client.query('BEGIN');
        
        // Llamar al procedimiento almacenado
        const result = await client.query('SELECT * FROM sp_reporte_ventas($1, $2)', [filtro, fecha]);
        await client.query('COMMIT');
        
        // Devolver directamente el array de resultados
        const data = Array.isArray(result.rows) ? result.rows : [];
        res.json(data);
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error en /reportes/ventas:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) client.release();
    }
}));

// Ruta para el reporte de productos
router.get('/productos', asyncHandler(async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        
        const result = await client.query('SELECT * FROM reporteproductosvendidos()');
        
        // Convertir nombres de columnas a minúsculas
        const allProducts = result.rows.map(item => ({
            producto_codigo: item.cod_producto, // nota: minúscula
            producto_nombre: item.nombre, // nota: minúscula
            cantidad_vendida: item.cantidadvendida, // nota: minúscula
            producto_tipo: item.tipo // nota: minúscula
        }));
        
        // Separar por tipo
        const responseData = {
            topProducts: allProducts.filter(p => p.producto_tipo === 'Más Vendido'),
            worstProducts: allProducts.filter(p => p.producto_tipo === 'Menos Vendido'),
            notSoldProducts: allProducts.filter(p => p.producto_tipo === 'No Vendido')
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
        console.error('Error en /reportes/productos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte de productos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) client.release();
    }
}));

// Ruta para el reporte de productos detallado
router.get('/productos-detallado', asyncHandler(async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT 
                p.cod_producto AS "Cod_Producto",
                p.nombre AS "Nombre",
                p.marca AS "Marca",
                CONCAT(pr.nombre, ' ', pr.apellido) AS "NombreProveedor",
                p.sector AS "Sector",
                pp.fecha_entrada AS "Fecha_Entrada",
                pp.cantidad AS "Cantidad",
                pp.precio AS "Precio",
                p.fechavencimiento AS "FechaVencimiento"
            FROM producto p
            JOIN proveproduct pp ON p.cod_producto = pp.cod_producto
            JOIN proveedor pr ON pp.cod_proveedor = pr.cod_proveedor
            WHERE pr.estado = 'Activo'
            ORDER BY p.nombre, pp.fecha_entrada
        `);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: result.rows.length
            }
        });
    } catch (error) {
        console.error('Error en /reportes/productos-detallado:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte detallado de productos'
        });
    } finally {
        if (client) client.release();
    }
}));

router.get('/ganancias', asyncHandler(async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        
        // Consulta SQL con alias en el formato correcto (con mayúsculas)
        const result = await client.query(`
            SELECT 
                pv.cod_venta AS "Cod_Venta",
                p.cod_producto AS "Cod_Producto",
                p.nombre AS "Nombre_Producto",
                pv.cantidad_venta AS "Cantidad_Venta",
                pp.precio AS "Costo_Unitario",
                ROUND(pp.precio * 1.25, 2) AS "Precio_Venta_Unitario",
                ROUND((pp.precio * 1.25) - pp.precio, 2) AS "Margen_Unitario",
                ROUND(((pp.precio * 1.25) - pp.precio) * pv.cantidad_venta, 2) AS "Margen_Total",
                ROUND((0.25 / pp.precio * 100), 2) AS "Porcentaje_Utilidad",
                TO_CHAR(pp.fecha_entrada, 'DD/MM/YYYY') AS "Fecha_Compra",
                TO_CHAR(pv.fecha_salida, 'DD/MM/YYYY') AS "Fecha_Venta"
            FROM productventa pv
            JOIN producto p ON pv.cod_producto = p.cod_producto
            JOIN proveproduct pp ON pv.cod_producto = pp.cod_producto
            WHERE p.estado = 'Activo'
            ORDER BY pv.cod_venta, p.nombre
        `);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: result.rows.length
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
        if (client) client.release();
    }
}));

// Ruta para obtener lista de empleados
router.get('/empleados', asyncHandler(async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT 
                cod_empleado AS "Cod_Empleado", 
                nombre AS "Nombre", 
                apellido AS "Apellido"
            FROM empleado 
            WHERE estado = 'Activo'
            ORDER BY nombre, apellido
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error en /reportes/empleados:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener la lista de empleados'
        });
    } finally {
        if (client) client.release();
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

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Llamar a la función en lugar del procedimiento
        const result = await client.query('SELECT * FROM sp_reporte_ventas_empleado($1, $2, $3)', [filtro, fecha, empleado_id]);
        await client.query('COMMIT');
        
        const data = Array.isArray(result.rows) ? result.rows : [];
        res.json(data);
        
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error en /reportes/ventas-empleado:', error);
        res.status(500).json({ 
            success: false, 
            message: DEFAULT_ERROR_MESSAGE,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) client.release();
    }
}));

// Ruta para el reporte de bajas de productos
router.post('/bajas', asyncHandler(async (req, res) => {
    const { filtro, fecha } = req.body;
    
    let client;
    try {
        client = await pool.connect();
        
        let query = `
            SELECT 
                b.id_baja AS "Id_Baja",
                b.cod_producto AS "Cod_Producto",
                p.nombre AS "Nombre_Producto",
                pr.nombre AS "Nombre_Proveedor",
                b.fecha_baja AS "Fecha_Baja",
                b.fecha_salida_baja AS "Fecha_Salida_Baja",
                b.cantidad AS "Cantidad",
                pp.precio AS "Precio_Compra",
                (b.cantidad * pp.precio) AS "Subtotal",
                b.motivo AS "Motivo"
            FROM bajasproductos b
            JOIN producto p ON b.cod_producto = p.cod_producto
            JOIN proveedor pr ON b.cod_proveedor = pr.cod_proveedor
            JOIN proveproduct pp ON b.cod_producto = pp.cod_producto AND b.cod_proveedor = pp.cod_proveedor
        `;
        
        // Aplicar filtros
        if (filtro === 'mes' && fecha) {
            const [year, month] = fecha.split('-');
            query += ` WHERE EXTRACT(YEAR FROM b.fecha_baja) = ${year} AND EXTRACT(MONTH FROM b.fecha_baja) = ${month}`;
        } else if (filtro === 'anio' && fecha) {
            query += ` WHERE EXTRACT(YEAR FROM b.fecha_baja) = ${fecha}`;
        }
        
        query += ' ORDER BY b.fecha_baja DESC';
        
        const result = await client.query(query);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: result.rows.length
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
        if (client) client.release();
    }
}));

// Ruta para reporte de bodega (basado en tu procedimiento sp_reporte_bodega)
router.post('/bodega', asyncHandler(async (req, res) => {
    const { sector, periodo = 'todos', search } = req.query;
    
    let client;
    try {
        client = await pool.connect();
        
        // Llamar al procedimiento almacenado de bodega
        const result = await client.query('SELECT * FROM sp_reporte_bodega($1, $2, $3)', [sector, periodo, search]);
        
        res.json({
            success: true,
            data: result.rows,
            metadata: {
                generatedAt: new Date().toISOString(),
                count: result.rows.length
            }
        });
        
    } catch (error) {
        console.error('Error en /reportes/bodega:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el reporte de bodega',
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