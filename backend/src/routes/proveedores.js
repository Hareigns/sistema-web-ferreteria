import express from "express";
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Helper para validar datos del proveedor
const validateProveedorData = (data) => {
  const { nombre, apellido, sector, telefono, compania, estado } = data;
  const errors = [];

  if (!nombre) errors.push("El nombre es requerido");
  if (!apellido) errors.push("El apellido es requerido");
  if (!sector) errors.push("El sector es requerido");
  if (!telefono) errors.push("El teléfono es requerido");
  if (!compania) errors.push("La compañía es requerida");
  if (!estado) errors.push("El estado es requerido");

  if (telefono && !/^\d{8,9}$/.test(telefono)) {
    errors.push("El teléfono debe contener solo números (8-9 dígitos)");
  }

  return errors;
};

// Mostrar formulario de añadir proveedor
router.get("/add", isLoggedIn, (req, res) => {
  res.render("proveedores/add", {
    title: "Agregar Proveedor",
    proveedor: {},
    messages: req.flash()
  });
});

// Mostrar lista de proveedores
router.get("/list", isLoggedIn, async (req, res) => {
  try {
    const [proveedores] = await pool.query(`
      SELECT p.Cod_Proveedor, p.Nombre, p.Apellido, p.Sector, 
             t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
      ORDER BY p.Nombre, p.Apellido
    `);

    res.render("proveedores/list", {
      title: "Lista de Proveedores",
      proveedores,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al obtener lista de proveedores:", error);
    req.flash('error', 'Error al cargar lista de proveedores');
    res.redirect('/proveedores');
  }
});

// Modificar la ruta '/add' para que devuelva los proveedores actualizados
router.post('/add', isLoggedIn, async (req, res) => {
  const { nombre, apellido, sector, telefono, compania, estado } = req.body;

  const validationErrors = validateProveedorData(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, errors: validationErrors });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insertar en Proveedor
    const proveedorData = { 
      Nombre: nombre, 
      Apellido: apellido, 
      Sector: sector,
      Estado: estado 
    };
    const [result] = await connection.query('INSERT INTO Proveedor SET ?', [proveedorData]);

    // Obtener el ID generado automáticamente
    const nuevoCodProveedor = result.insertId;

    // Insertar en Teléfono
    const telefonoData = { 
      Numero: telefono, 
      Compania: compania, 
      Cod_Proveedor: nuevoCodProveedor, 
      Cod_Empleado: null 
    };
    await connection.query('INSERT INTO Telefono SET ?', [telefonoData]);

    await connection.commit();

    // Obtener la lista actualizada de proveedores
    const [proveedores] = await connection.query(`
      SELECT p.Cod_Proveedor, p.Nombre, p.Apellido, p.Sector, p.Estado,
             t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
    `);

    res.json({ success: true, data: proveedores });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error al agregar proveedor:", error);
    res.status(500).json({ success: false, error: 'Error al agregar proveedor' });
  } finally {
    if (connection) connection.release();
  }
});

  

// API para obtener proveedores (JSON)
router.get('/api/proveedores', isLoggedIn, async (req, res) => {
  try {
    const [proveedores] = await pool.query(`
      SELECT p.Cod_Proveedor, p.Nombre, p.Apellido, p.Sector, p.Estado,
             t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
    `);

    res.json({ success: true, data: proveedores });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    res.status(500).json({ success: false, error: 'Error al obtener proveedores' });
  }
});

export { router };
