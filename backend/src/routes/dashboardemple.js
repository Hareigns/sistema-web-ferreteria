import express from 'express';
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Ruta para la página principal del dashboard de empleado
router.get('/', isLoggedIn, (req, res) => {
    res.render('dashboardemple/add');
});

// Ruta para las estadísticas del empleado específico
router.get('/:empleadoId', isLoggedIn, async (req, res) => {
  try {
    const { empleadoId } = req.params;

    console.log('Usuario autenticado:', req.user); // ← Agrega esto para debuggear
    console.log('ID solicitado:', empleadoId); // ← Y esto

    // Validar que el empleado solo pueda ver sus propios datos
    if (req.user.cod_empleado != empleadoId) { // ← Cambiado a minúsculas
      return res.status(403).json({
        success: false,
        message: 'No autorizado para ver estos datos'
      });
    }

    // 1. Consulta de ventas diarias del empleado específico (PostgreSQL)
    const ventasDiarias = await pool.query(`
      SELECT 
        DATE(pv.fecha_salida) AS fecha,
        SUM(pv.precio_venta * pv.cantidad_venta) AS total,
        COUNT(DISTINCT v.cod_venta) AS cantidad_ventas
      FROM venta v
      JOIN productventa pv ON v.cod_venta = pv.cod_venta
      WHERE v.estado_venta IN ('Finalizada', 'Completada')
        AND v.cod_empleado = $1
        AND pv.fecha_salida >= CURRENT_DATE - INTERVAL '15 days'
      GROUP BY DATE(pv.fecha_salida)
      ORDER BY fecha DESC
    `, [empleadoId]);

    res.json({
      success: true,
      ventasDiarias: ventasDiarias.rows
    });

  } catch (error) {
    console.error('Error en estadísticas empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

export default router;