import express from 'express';
import pool from '../database.js';

const router = express.Router();

// Ruta para la página principal del dashboard
router.get('/', (req, res) => {
  res.render('dashboard');
});

// Ruta para las estadísticas (API)
router.get('/estadisticas', async (req, res) => {
  try {
    // Desactivar ONLY_FULL_GROUP_BY solo para esta conexión
    await pool.query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");

    // 1. Consulta de ventas diarias
    const [ventasDiarias] = await pool.query(`
      SELECT 
        DATE_FORMAT(pv.Fecha_salida, '%Y-%m-%d') AS fecha,
        SUM(pv.Precio_Venta * pv.Cantidad_Venta) AS total,
        COUNT(DISTINCT v.Cod_Venta) AS cantidad_ventas
      FROM Venta v
      JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      WHERE v.Estado_Venta IN ('Finalizada', 'Completada')
      GROUP BY DATE_FORMAT(pv.Fecha_salida, '%Y-%m-%d')
      ORDER BY pv.Fecha_salida DESC
      LIMIT 15
    `);

// 2. Consulta de ventas por empleado (versión que muestra todos los empleados)
const [ventasEmpleados] = await pool.query(`
  SELECT 
    e.Cod_Empleado,
    CONCAT(e.Nombre, ' ', e.Apellido) AS nombre,
    COALESCE(SUM(pv.Precio_Venta * pv.Cantidad_Venta), 0) AS total,
    COALESCE(COUNT(DISTINCT v.Cod_Venta), 0) AS cantidad_ventas
  FROM Empleado e
  LEFT JOIN Venta v ON e.Cod_Empleado = v.Cod_Empleado 
    AND v.Estado_Venta IN ('Finalizada', 'Completada')
  LEFT JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
  WHERE e.Estado = 'Activo'
  GROUP BY e.Cod_Empleado, e.Nombre, e.Apellido
  ORDER BY total DESC
`);

    // 3. Datos resumen
    const [resumen] = await pool.query(`
      SELECT 
        SUM(pv.Precio_Venta * pv.Cantidad_Venta) AS ventas_totales,
        COUNT(DISTINCT v.Cod_Venta) AS total_ventas,
        COUNT(DISTINCT e.Cod_Empleado) AS empleados_activos,
        (SELECT CONCAT(Nombre, ' ', Apellido) FROM Empleado 
         JOIN Venta ON Empleado.Cod_Empleado = Venta.Cod_Empleado
         JOIN ProductVenta ON Venta.Cod_Venta = ProductVenta.Cod_Venta
         WHERE Venta.Estado_Venta IN ('Finalizada', 'Completada')
         GROUP BY Empleado.Cod_Empleado
         ORDER BY SUM(ProductVenta.Precio_Venta * ProductVenta.Cantidad_Venta) DESC
         LIMIT 1) AS empleado_destacado
      FROM Venta v
      JOIN ProductVenta pv ON v.Cod_Venta = pv.Cod_Venta
      JOIN Empleado e ON v.Cod_Empleado = e.Cod_Empleado
      WHERE v.Estado_Venta IN ('Finalizada', 'Completada')
    `);

    res.json({
      success: true,
      ventasDiarias,
      ventasEmpleados,
      resumen: {
        ventas_totales: resumen[0]?.ventas_totales || 0,
        total_ventas: resumen[0]?.total_ventas || 0,
        empleados_activos: resumen[0]?.empleados_activos || 0,
        empleado_destacado: resumen[0]?.empleado_destacado || 'N/A'
      }
    });

  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

export default router;