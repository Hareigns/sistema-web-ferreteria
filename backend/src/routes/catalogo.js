import express from 'express';
import { isNotLoggedIn } from '../lib/auth.js';
import pool from '../database.js';

const router = express.Router();

// Ruta principal del catálogo
router.get('/', isNotLoggedIn, async (req, res) => {
    try {
        // Obtener todos los productos activos
        const query = `
            SELECT 
                p.cod_producto::text as id,
                p.cod_producto::text as codigo,
                p.nombre,
                COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                COALESCE(p.sector, 'General') as categoria,
                COALESCE(lp.precio, 0) as precio,
                COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
            FROM 
                producto p
            LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
            WHERE 
                p.estado = 'Activo'
            GROUP BY 
                p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
            ORDER BY 
                p.nombre
        `;
        
        const result = await pool.query(query);
        const productos = result.rows; // ← DEFINIR la variable productos aquí
        
        // Obtener categorías únicas para el filtro
        const categoriasResult = await pool.query(
            'SELECT DISTINCT sector as categoria FROM producto WHERE estado = $1 AND sector IS NOT NULL ORDER BY sector',
            ['Activo']
        );
        
        const categorias = categoriasResult.rows.map(row => row.categoria);

        res.render('catalogo', { 
            title: 'Catálogo de Productos',
            productos: productos, // ← Ahora productos está definido
            categorias: categorias,
            searchTerm: '',
            categoriaFilter: ''
        });
    } catch (err) {
        console.error('Error al obtener productos del catálogo:', err);
        res.render('catalogo', { 
            title: 'Catálogo de Productos',
            productos: [], // ← En caso de error, pasar array vacío
            categorias: [],
            searchTerm: '',
            categoriaFilter: ''
        });
    }
});

// Ruta para búsqueda de productos
router.get('/buscar', isNotLoggedIn, async (req, res) => {
    try {
        const { q, categoria } = req.query;
        let productos = []; // ← DEFINIR productos aquí
        let categorias = [];

        // Obtener categorías únicas
        const categoriasResult = await pool.query(
            'SELECT DISTINCT sector as categoria FROM producto WHERE estado = $1 AND sector IS NOT NULL ORDER BY sector',
            ['Activo']
        );
        categorias = categoriasResult.rows.map(row => row.categoria);

        // Lógica de búsqueda y filtrado
        if (categoria && categoria !== '') {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                    AND p.sector ILIKE '%' || $1 || '%'
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query, [categoria]);
            productos = result.rows;
        } else if (q && q.trim() !== '') {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                    AND (
                        p.nombre ILIKE '%' || $1 || '%'
                        OR p.descripcion ILIKE '%' || $1 || '%'
                        OR p.sector ILIKE '%' || $1 || '%'
                    )
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query, [q.trim()]);
            productos = result.rows;
        } else {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query);
            productos = result.rows;
        }

        res.render('catalogo', { 
            title: 'Catálogo de Productos',
            productos: productos,
            categorias: categorias,
            searchTerm: q || '',
            categoriaFilter: categoria || ''
        });
    } catch (err) {
        console.error('Error en búsqueda de productos:', err);
        res.render('catalogo', { 
            title: 'Catálogo de Productos',
            productos: [],
            categorias: [],
            searchTerm: req.query.q || '',
            categoriaFilter: req.query.categoria || ''
        });
    }
});

// NUEVO: Endpoint API para búsqueda (JSON)
router.get('/api/buscar', isNotLoggedIn, async (req, res) => {
    try {
        const { q, categoria } = req.query;
        let productos = [];

        if (categoria && categoria !== '') {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                    AND p.sector ILIKE '%' || $1 || '%'
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query, [categoria]);
            productos = result.rows;
        } else if (q && q.trim() !== '') {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de quality') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                    AND (
                        p.nombre ILIKE '%' || $1 || '%'
                        OR p.descripcion ILIKE '%' || $1 || '%'
                        OR p.sector ILIKE '%' || $1 || '%'
                    )
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query, [q.trim()]);
            productos = result.rows;
        } else {
            const query = `
                SELECT 
                    p.cod_producto::text as id,
                    p.cod_producto::text as codigo,
                    p.nombre,
                    COALESCE(p.descripcion, 'Producto de calidad') as descripcion,
                    COALESCE(p.sector, 'General') as categoria,
                    COALESCE(lp.precio, 0) as precio,
                    COALESCE(SUM(lp.cantidad_disponible), 0)::integer as stock,
                    COALESCE(p.imagen_url, '/images/default-product.jpg') as imagen_url
                FROM 
                    producto p
                LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
                WHERE 
                    p.estado = 'Activo'
                GROUP BY 
                    p.cod_producto, p.nombre, p.descripcion, p.sector, p.imagen_url, lp.precio
                ORDER BY 
                    p.nombre
            `;
            const result = await pool.query(query);
            productos = result.rows;
        }

        res.json({
            success: true,
            productos: productos,
            count: productos.length
        });
    } catch (err) {
        console.error('Error en búsqueda de productos:', err);
        res.status(500).json({
            success: false,
            message: 'Error al buscar productos',
            productos: []
        });
    }
});

// NUEVO: Endpoint API para categorías (JSON)
router.get('/api/categorias', isNotLoggedIn, async (req, res) => {
    try {
        const categoriasResult = await pool.query(
            'SELECT DISTINCT sector as categoria FROM producto WHERE estado = $1 AND sector IS NOT NULL ORDER BY sector',
            ['Activo']
        );
        
        const categorias = categoriasResult.rows.map(row => row.categoria);

        res.json({
            success: true,
            categorias: categorias
        });
    } catch (err) {
        console.error('Error al obtener categorías:', err);
        res.status(500).json({
            success: false,
            categorias: []
        });
    }
});

export { router };