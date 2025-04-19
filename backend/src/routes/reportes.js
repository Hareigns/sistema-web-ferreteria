import express from 'express';
import pool from '../database.js';
import { database } from '../keys.js';


const router = express.Router();

// Ruta para mostrar la vista
router.get('/add', (req, res) => {
    res.render('reportes/add');
});


router.post('/ventas', async (req, res) => {
  const { filtro } = req.body;
  console.log("Filtro recibido:", filtro);

  try {
      const [rows] = await pool.query('CALL sp_reporte_ventas(?)', [filtro]);
      console.log("Resultado:", rows);
      res.json(rows[0]);
  } catch (err) {
      console.error("Error en el procedimiento:", err);
      res.status(500).json({ error: 'Error al generar el reporte' });
  }
});


router.get('/productos', async (req, res) => {
    try {
        const [rows] = await pool.query('CALL ReporteProductosVendidos()');
        res.json(rows[0]); // Enviar solo los datos al frontend
    } catch (error) {
        console.error('Error al obtener datos de productos:', error);
        res.status(500).json({ error: 'Error al generar el reporte de productos' });
    }
});



export { router };