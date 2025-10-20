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

// Middleware para verificar conexión a la base de datos
const checkDBConnection = async (req, res, next) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        next();
    } catch (error) {
        console.error('Error de conexión a la base de datos:', error);
        
        if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'Servicio no disponible. Error de conexión con la base de datos.'
            });
        }
        
        next(error);
    }
};

// Usar el middleware en las rutas críticas
router.use('/api/reporte', checkDBConnection);

// Ruta para obtener reporte de bodega con sistema de lotes (MEJORADA)
router.get('/api/reporte', async (req, res) => {
    const { sector, periodo = 'todos', search } = req.query;

    let client;
    try {
        client = await pool.connect();

        // Si no hay ningún filtro, obtener todos los productos activos con stock REAL
        if (!sector && !search && periodo === 'todos') {
            const result = await client.query(`
                SELECT 
                    p.cod_producto,
                    p.nombre,
                    p.marca,
                    -- FECHA del último lote (más reciente)
                    COALESCE(
                        (SELECT lp.fecha_entrada 
                         FROM lotes_producto lp 
                         WHERE lp.cod_producto = p.cod_producto 
                         ORDER BY lp.fecha_entrada DESC, lp.id_lote DESC 
                         LIMIT 1),
                        pp.fecha_entrada,
                        CURRENT_DATE
                    ) AS fechaentrada,
                    -- STOCK REAL de lotes_producto (suma de todos los lotes disponibles)
                    COALESCE(
                        (SELECT SUM(lp2.cantidad_disponible) 
                         FROM lotes_producto lp2 
                         WHERE lp2.cod_producto = p.cod_producto),
                        pp.cantidad,
                        0
                    ) AS cantidad,
                    p.fechavencimiento,
                    p.sector,
                    p.descripcion,
                    -- PRECIO del último lote (más reciente)
                    COALESCE(
                        (SELECT lp3.precio 
                         FROM lotes_producto lp3 
                         WHERE lp3.cod_producto = p.cod_producto 
                         ORDER BY lp3.fecha_entrada DESC, lp3.id_lote DESC 
                         LIMIT 1),
                        pp.precio,
                        0
                    ) AS precio_compra,
                    -- PROVEEDOR del último lote
                    COALESCE(
                        (SELECT lp4.cod_proveedor 
                         FROM lotes_producto lp4 
                         WHERE lp4.cod_producto = p.cod_producto 
                         ORDER BY lp4.fecha_entrada DESC, lp4.id_lote DESC 
                         LIMIT 1),
                        pp.cod_proveedor,
                        NULL
                    ) AS cod_proveedor,
                    pr.nombre AS proveedor_nombre,
                    pr.apellido AS proveedor_apellido
                FROM 
                    producto p
                LEFT JOIN 
                    proveproduct pp ON p.cod_producto = pp.cod_producto
                LEFT JOIN 
                    proveedor pr ON COALESCE(
                        (SELECT lp5.cod_proveedor 
                         FROM lotes_producto lp5 
                         WHERE lp5.cod_producto = p.cod_producto 
                         ORDER BY lp5.fecha_entrada DESC, lp5.id_lote DESC 
                         LIMIT 1),
                        pp.cod_proveedor
                    ) = pr.cod_proveedor
                WHERE 
                    p.estado = 'Activo'
                    AND COALESCE(
                        (SELECT SUM(lp6.cantidad_disponible) 
                         FROM lotes_producto lp6 
                         WHERE lp6.cod_producto = p.cod_producto),
                        pp.cantidad,
                        0
                    ) > 0
                ORDER BY p.nombre ASC
            `);
            
            return res.json({
                success: true,
                data: result.rows
            });
        }
        
        // Para búsquedas con filtros, usar una consulta dinámica
        let query = `
            SELECT 
                p.cod_producto,
                p.nombre,
                p.marca,
                -- FECHA del último lote (más reciente)
                COALESCE(
                    (SELECT lp.fecha_entrada 
                     FROM lotes_producto lp 
                     WHERE lp.cod_producto = p.cod_producto 
                     ORDER BY lp.fecha_entrada DESC, lp.id_lote DESC 
                     LIMIT 1),
                    pp.fecha_entrada,
                    CURRENT_DATE
                ) AS fechaentrada,
                -- STOCK REAL de lotes_producto (suma de todos los lotes disponibles)
                COALESCE(
                    (SELECT SUM(lp2.cantidad_disponible) 
                     FROM lotes_producto lp2 
                     WHERE lp2.cod_producto = p.cod_producto),
                    pp.cantidad,
                    0
                ) AS cantidad,
                p.fechavencimiento,
                p.sector,
                p.descripcion,
                -- PRECIO del último lote (más reciente)
                COALESCE(
                    (SELECT lp3.precio 
                     FROM lotes_producto lp3 
                     WHERE lp3.cod_producto = p.cod_producto 
                     ORDER BY lp3.fecha_entrada DESC, lp3.id_lote DESC 
                     LIMIT 1),
                    pp.precio,
                    0
                ) AS precio_compra,
                -- PROVEEDOR del último lote
                COALESCE(
                    (SELECT lp4.cod_proveedor 
                     FROM lotes_producto lp4 
                     WHERE lp4.cod_producto = p.cod_producto 
                     ORDER BY lp4.fecha_entrada DESC, lp4.id_lote DESC 
                     LIMIT 1),
                    pp.cod_proveedor,
                    NULL
                ) AS cod_proveedor,
                pr.nombre AS proveedor_nombre,
                pr.apellido AS proveedor_apellido
            FROM 
                producto p
            LEFT JOIN 
                proveproduct pp ON p.cod_producto = pp.cod_producto
            LEFT JOIN 
                proveedor pr ON COALESCE(
                    (SELECT lp5.cod_proveedor 
                     FROM lotes_producto lp5 
                     WHERE lp5.cod_producto = p.cod_producto 
                     ORDER BY lp5.fecha_entrada DESC, lp5.id_lote DESC 
                     LIMIT 1),
                    pp.cod_proveedor
                ) = pr.cod_proveedor
            WHERE 
                p.estado = 'Activo'
                AND COALESCE(
                    (SELECT SUM(lp6.cantidad_disponible) 
                     FROM lotes_producto lp6 
                     WHERE lp6.cod_producto = p.cod_producto),
                    pp.cantidad,
                    0
                ) > 0
        `;
        
        const params = [];
        let paramCount = 0;

        // Filtro por sector
        if (sector) {
            paramCount++;
            query += ` AND p.sector = $${paramCount}`;
            params.push(sector);
        }

        // Filtro por búsqueda (nombre o código)
        if (search) {
            paramCount++;
            query += ` AND (p.nombre ILIKE $${paramCount} OR p.cod_producto::text ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Filtro por período (basado en la fecha del último lote)
        if (periodo !== 'todos') {
            const intervalCondition = getPeriodCondition(periodo);
            // Reemplazar el placeholder con la condición real
            query += ` AND COALESCE(
                (SELECT lp7.fecha_entrada 
                 FROM lotes_producto lp7 
                 WHERE lp7.cod_producto = p.cod_producto 
                 ORDER BY lp7.fecha_entrada DESC, lp7.id_lote DESC 
                 LIMIT 1),
                pp.fecha_entrada,
                CURRENT_DATE
            ) ${intervalCondition}`;
        }

        query += ' ORDER BY p.nombre ASC';

        const result = await client.query(query, params);
        
        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error en reporte de bodega:', error);
        
        if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                message: 'Error de conexión con la base de datos'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte',
            error: error.message
        });
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error al liberar cliente:', releaseError);
            }
        }
    }
});

// Función auxiliar para construir condición de período (MEJORADA)
function getPeriodCondition(periodo) {
    switch(periodo) {
        case 'diario':
            return ">= CURRENT_DATE - INTERVAL '1 DAY'";
        case 'semanal':
            return ">= CURRENT_DATE - INTERVAL '7 DAY'";
        case 'mensual':
            return ">= CURRENT_DATE - INTERVAL '1 MONTH'";
        default:
            return ">= CURRENT_DATE - INTERVAL '1 DAY'";
    }
}

// Ruta adicional para obtener productos con stock bajo (opcional)
router.get('/api/stock-bajo', isLoggedIn, async (req, res) => {
    const { limite = 10 } = req.query;
    let client;

    try {
        client = await pool.connect();

        const result = await client.query(`
            SELECT 
                p.cod_producto,
                p.nombre,
                p.marca,
                p.sector,
                COALESCE(SUM(lp.cantidad_disponible), 0) as stock_actual,
                -- Umbral de stock bajo: menos de 10 unidades o definir según tu negocio
                CASE 
                    WHEN COALESCE(SUM(lp.cantidad_disponible), 0) < 10 THEN 'CRÍTICO'
                    WHEN COALESCE(SUM(lp.cantidad_disponible), 0) < 20 THEN 'BAJO'
                    ELSE 'NORMAL'
                END as nivel_stock
            FROM producto p
            LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
            WHERE p.estado = 'Activo'
            GROUP BY p.cod_producto, p.nombre, p.marca, p.sector
            HAVING COALESCE(SUM(lp.cantidad_disponible), 0) < 20  -- Ajusta este valor según necesites
            ORDER BY stock_actual ASC
            LIMIT $1
        `, [limite]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al obtener stock bajo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productos con stock bajo'
        });
    } finally {
        client?.release();
    }
});

export { router };