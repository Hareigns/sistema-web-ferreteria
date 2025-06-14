import express from 'express';
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Ruta para la página principal del dashboard de empleado
router.get('/', isLoggedIn, (req, res) => {
    res.render('dashboardemple/add'); // ¿Estás seguro que quieres renderizar 'dashboardemple/add'?
});

// Ruta para las estadísticas del empleado específico
router.get('/:empleadoId', isLoggedIn, async (req, res) => { // Agregué isLoggedIn aquí también
  try {
    const { empleadoId } = req.params;

    // Validar que el empleado solo pueda ver sus propios datos
    if (req.user.Cod_Empleado != empleadoId) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para ver estos datos'
      });
    }

    // 1. Consulta de ventas diarias del empleado específico
    const [ventasDiarias] = await pool.query(`
      SELECT 
        DATE(pv.Fecha_salida) AS fecha,
        SUM(pv.Precio_Venta * pv.Cantidad_Venta) AS total,
        COUNT(DISTINCT v.Cod_Venta) AS cantidad_ventas
      FROM Venta v
      JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      WHERE v.Estado_Venta IN ('Finalizada', 'Completada')
        AND v.Cod_Empleado = ?
        AND pv.Fecha_salida >= DATE(DATE_SUB(NOW(), INTERVAL 15 DAY))
      GROUP BY DATE(pv.Fecha_salida)
      ORDER BY fecha DESC
    `, [empleadoId]);

    res.json({
      success: true,
      ventasDiarias
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