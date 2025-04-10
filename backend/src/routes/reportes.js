import express from 'express';
import pool from '../database.js';
import { isLoggedIn } from "../lib/auth.js";


const router = express.Router();

// Ruta para mostrar el formulario de agregar reporte
router.get('/add', (req, res) => {
    res.render('reportes/add'); // Renderiza la vista 'add.hbs'
  });
  


  router.post('/generar', async (req, res) => {
    const { tipo_reporte, periodo } = req.body;
  
    if (!tipo_reporte || !periodo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos',
      });
    }
  
    try {
      const [result] = await pool.query(
        'INSERT INTO Reportes (Tipo_Reporte, Periodo, Fecha_Generacion) VALUES (?, ?, ?)',
        [tipo_reporte, periodo, new Date()]
      );
  
      res.status(200).json({
        success: true,
        message: 'Reporte generado y guardado en la base de datos',
        reportId: result.insertId, // ID del reporte generado
      });
    } catch (error) {
      console.error('Error al generar reporte:', error);
      res.status(500).json({
        success: false,
        message: `Error al generar reporte: ${error.message}`,
      });
    }
  });


export { router };