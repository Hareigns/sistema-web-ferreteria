import express from 'express';
import pool from '../database.js';
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Mostrar formulario de bajas
router.get('/add', isLoggedIn, async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT p.Cod_Producto, p.Nombre, p.Marca, 
                   COALESCE(SUM(pp.Cantidad), 0) as Stock
            FROM Producto p
            LEFT JOIN ProveProduct pp ON p.Cod_Producto = pp.Cod_Producto
            WHERE p.Estado = 'Activo'
            GROUP BY p.Cod_Producto
            HAVING Stock > 0
            ORDER BY p.Nombre
        `);
        
        // Pasar los mensajes flash como variables locales
        res.locals.success = req.flash('success')[0];
        res.locals.error = req.flash('error')[0];
        
        res.render('outlet/add', { products });
    } catch (error) {
        console.error('Error al cargar productos:', error);
        req.flash('error', 'Error al cargar los productos');
        res.redirect('/dashboard');
    }
});

// Procesar baja de producto
router.post('/add', isLoggedIn, async (req, res) => {
    const { product_id, reason, quantity, notes } = req.body;
    
    try {
        // Validación básica
        if (!product_id || !reason || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos requeridos deben estar completos'
            });
        }

        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La cantidad debe ser un número válido mayor a cero'
            });
        }

        // 1. Obtener el lote más antiguo (FIFO)
        const [lotes] = await pool.query(
            `SELECT * FROM ProveProduct 
             WHERE Cod_Producto = ? AND Cantidad > 0
             ORDER BY Fecha_Entrada ASC LIMIT 1`,
            [product_id]
        );

        if (!lotes?.length) {
            req.flash('error', 'No se encontró stock disponible');
            return res.redirect('/outlet/add');
        }

        const lote = lotes[0];
        const nuevaCantidad = lote.Cantidad - qty;

        // 2. Determinar motivo final (incluye "notes" si es motivo "Otro")
        const motivoFinal = reason === 'Otro' && notes ? `${reason}: ${notes}` : reason;

        // 3. Registrar en BajasProductos (sin campo Observaciones)
        await pool.query(
            `INSERT INTO BajasProductos 
             (Cod_Producto, Cod_Proveedor, Fecha_Salida_Baja, Fecha_Baja, Cantidad, Motivo)
             VALUES (?, ?, CURDATE(), NOW(), ?, ?)`,
            [product_id, lote.Cod_Proveedor, qty, motivoFinal]
        );

        // 4. Actualizar el stock en ProveProduct
        await pool.query(
            `UPDATE ProveProduct 
             SET Cantidad = ?
             WHERE Cod_Producto = ? AND Cod_Proveedor = ? AND Fecha_Entrada = ?`,
            [nuevaCantidad, lote.Cod_Producto, lote.Cod_Proveedor, lote.Fecha_Entrada]
        );

        // 5. Mostrar confirmación - Versión simplificada como tu ejemplo
         const [product] = await pool.query(
            'SELECT Nombre FROM Producto WHERE Cod_Producto = ?',
            [product_id]
        );
        
       return res.json({ 
            success: true,
            message: 'Baja registrada correctamente'
        });
        
    } catch (error) {
        console.error('Error al registrar baja:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export { router };