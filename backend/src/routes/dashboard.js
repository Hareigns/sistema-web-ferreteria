import express from 'express';
import pool from '../database.js';

const router = express.Router();

// Ruta para la página principal del dashboard
router.get('/', (req, res) => {
  res.render('dashboard');
});

// Ruta para las estadísticas (API)
router.get('/estadisticas', async (req, res) => {
  let client;
  try {
    // Obtener cliente del pool
    client = await pool.connect();
    
    // 1. Consulta de ventas diarias
    const ventasDiariasQuery = `
      SELECT 
        DATE(pv.fecha_salida) AS fecha,
        SUM(pv.precio_venta * pv.cantidad_venta) AS total,
        COUNT(DISTINCT v.cod_venta) AS cantidad_ventas
      FROM venta v
      JOIN productventa pv ON v.cod_venta = pv.cod_venta
      WHERE v.estado_venta IN ('Finalizada', 'Completada')
        AND pv.fecha_salida >= CURRENT_DATE - INTERVAL '15 days'
      GROUP BY DATE(pv.fecha_salida)
      ORDER BY fecha DESC
    `;

    // 2. Consulta de ventas por empleado
    const ventasEmpleadosQuery = `
      SELECT 
        e.cod_empleado,
        CONCAT(e.nombre, ' ', e.apellido) AS nombre,
        COALESCE(SUM(pv.precio_venta * pv.cantidad_venta), 0) AS total,
        COALESCE(COUNT(DISTINCT v.cod_venta), 0) AS cantidad_ventas
      FROM empleado e
      LEFT JOIN venta v ON e.cod_empleado = v.cod_empleado 
        AND v.estado_venta IN ('Finalizada', 'Completada')
      LEFT JOIN productventa pv ON v.cod_venta = pv.cod_venta
      WHERE e.estado = 'Activo'
      GROUP BY e.cod_empleado, e.nombre, e.apellido
      ORDER BY total DESC
    `;

    // 3. Datos resumen
    const resumenQuery = `
      SELECT 
        SUM(pv.precio_venta * pv.cantidad_venta) AS ventas_totales,
        COUNT(DISTINCT v.cod_venta) AS total_ventas,
        COUNT(DISTINCT e.cod_empleado) AS empleados_activos,
        (SELECT CONCAT(nombre, ' ', apellido) FROM empleado 
         JOIN venta ON empleado.cod_empleado = venta.cod_empleado
         JOIN productventa ON venta.cod_venta = productventa.cod_venta
         WHERE venta.estado_venta IN ('Finalizada', 'Completada')
         GROUP BY empleado.cod_empleado, empleado.nombre, empleado.apellido
         ORDER BY SUM(productventa.precio_venta * productventa.cantidad_venta) DESC
         LIMIT 1) AS empleado_destacado
      FROM venta v
      JOIN productventa pv ON v.cod_venta = pv.cod_venta
      JOIN empleado e ON v.cod_empleado = e.cod_empleado
      WHERE v.estado_venta IN ('Finalizada', 'Completada')
    `;

    // Ejecutar consultas
    const ventasDiariasResult = await client.query(ventasDiariasQuery);
    const ventasEmpleadosResult = await client.query(ventasEmpleadosQuery);
    const resumenResult = await client.query(resumenQuery);

    const ventasDiarias = ventasDiariasResult.rows;
    const ventasEmpleados = ventasEmpleadosResult.rows;
    const resumen = resumenResult.rows;

    res.json({
      success: true,
      ventasDiarias,
      ventasEmpleados,
      resumen: {
        ventas_totales: parseFloat(resumen[0]?.ventas_totales) || 0,
        total_ventas: parseInt(resumen[0]?.total_ventas) || 0,
        empleados_activos: parseInt(resumen[0]?.empleados_activos) || 0,
        empleado_destacado: resumen[0]?.empleado_destacado || 'N/A'
      }
    });

  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  } finally {
    // Liberar el cliente de vuelta al pool
    if (client) {
      client.release();
    }
  }
});

export default router;