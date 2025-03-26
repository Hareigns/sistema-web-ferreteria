import express from "express";
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Helper para validar datos del Empleado
const validateEmpleadoData = (data) => {
  const { nombre, apellido, direccion, telefono, compania } = data;
  const errors = [];

  if (!nombre) errors.push("El nombre es requerido");
  if (!apellido) errors.push("El apellido es requerido");
  if (!direccion) errors.push("El direccion es requerido");
  if (!telefono) errors.push("El teléfono es requerido");
  if (!compania) errors.push("La compañía es requerida");

  if (telefono && !/^\d{8,9}$/.test(telefono)) {
    errors.push("El teléfono debe contener solo números (8-9 dígitos)");
  }

  return errors;
};

// Mostrar formulario de añadir Empleado
router.get("/add", isLoggedIn, (req, res) => {
  res.render("Empleados/add", {
    title: "Agregar Empleado",
    Empleado: {},
    messages: req.flash()
  });
});

// Mostrar lista de Empleados
router.get("/list", isLoggedIn, async (req, res) => {
  try {
    const [Empleados] = await pool.query(`
      SELECT e.Cod_Empleado, e.Nombre, e.Apellido, e.direccion, 
             t.Numero AS Telefono, t.Compania
      FROM Empleado e
      LEFT JOIN Telefono t ON e.Cod_Empleado = t.Cod_Empleado
      ORDER BY e.Nombre, e.Apellido
    `);

    res.render("Empleados/list", {
      title: "Lista de Empleados",
      Empleados,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al obtener lista de Empleados:", error);
    req.flash('error', 'Error al cargar lista de Empleados');
    res.redirect('/Empleados');
  }
});

// Modificar la ruta '/add' para que devuelva los Empleados actualizados
router.post('/add', isLoggedIn, async (req, res) => {
    const { nombre, apellido, direccion, telefono, compania } = req.body;
  
    const validationErrors = validateEmpleadoData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, errors: validationErrors });
    }
  
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
  
      // Insertar en Empleado
      const EmpleadoData = { Nombre: nombre, Apellido: apellido, direccion: direccion };
      const [result] = await connection.query('INSERT INTO Empleado SET ?', [EmpleadoData]);
  
      // Obtener el ID generado automáticamente
      const nuevoCodEmpleado = result.insertId;
  
      // Insertar en Teléfono
      const telefonoData = { Numero: telefono, Compania: compania, Cod_Empleado: nuevoCodEmpleado, Cod_Empleado: null };
      await connection.query('INSERT INTO Telefono SET ?', [telefonoData]);
  
      await connection.commit();
  
      // Obtener la lista actualizada de Empleados
      const [Empleados] = await connection.query(`
        SELECT e.Cod_Empleado, e.Nombre, e.Apellido, e.direccion, 
               t.Numero AS Telefono, t.Compania
        FROM Empleado e
        LEFT JOIN Telefono t ON e.Cod_Empleado = t.Cod_Empleado
      `);
  
      res.json({ success: true, data: Empleados }); // Retornar los Empleados actualizados
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Error al agregar Empleado:", error);
      res.status(500).json({ success: false, error: 'Error al agregar Empleado' });
    } finally {
      if (connection) connection.release();
    }
  });
  
  
  


// API para obtener Empleados (JSON)
router.get('/api/Empleados', isLoggedIn, async (req, res) => {
  try {
    const [Empleados] = await pool.query(`
      SELECT e.Cod_Empleado, e.Nombre, e.Apellido, e.direccion, 
             t.Numero AS Telefono, t.Compania
      FROM Empleado e
      LEFT JOIN Telefono t ON e.Cod_Empleado = t.Cod_Empleado
    `);

    res.json({ success: true, data: Empleados });
  } catch (error) {
    console.error("Error al obtener Empleados:", error);
    res.status(500).json({ success: false, error: 'Error al obtener Empleados' });
  }
});

export { router };
