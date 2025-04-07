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
  if (!direccion) errors.push("La dirección es requerida");
  if (!telefono) errors.push("El teléfono es requerido");
  if (!compania) errors.push("La compañía es requerida");

  if (telefono && !/^\d{8,9}$/.test(telefono)) {
    errors.push("El teléfono debe contener solo números (8 dígitos)");
  }

  // Verificar que la compañía sea válida
  if (compania && compania !== 'Tigo' && compania !== 'Claro') {
    errors.push("La compañía debe ser 'Tigo' o 'Claro'");
  }

  return errors;
};

// Mostrar formulario de añadir Empleado
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    const [Empleados] = await pool.query(`
      SELECT Cod_Empleado, Nombre, Apellido 
      FROM Empleado
      ORDER BY Nombre, Apellido
    `);

    res.render("Empleados/add", {
      title: "Agregar Empleado",
      Empleado: Empleados,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al obtener empleados:", error);
    req.flash("error", "Error al cargar empleados");
    res.redirect("/Empleados");
  }
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

// Ruta para agregar un empleado
router.post("/api/empleados", async (req, res) => {
  const { nombre, apellido, direccion, estado, telefono, compania } = req.body;

  try {
    // Validación adicional
    const validationErrors = validateEmpleadoData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: validationErrors 
      });
    }

    // Insertar en Empleado
    const [empleadoResult] = await pool.query(
      'INSERT INTO Empleado (Nombre, Apellido, Direccion, Estado) VALUES (?, ?, ?, ?)', 
      [nombre, apellido, direccion, estado]
    );

    const codEmpleado = empleadoResult.insertId;

    // Insertar en Telefono
    await pool.query(
      'INSERT INTO Telefono (Numero, Compania, Cod_Empleado) VALUES (?, ?, ?)', 
      [telefono, compania, codEmpleado]
    );

    res.status(201).json({ 
      success: true,
      message: 'Empleado agregado correctamente', 
      codEmpleado 
    });

  } catch (error) {
    console.error('Error al agregar el empleado:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
});

// Ruta para obtener los datos del empleado logueado
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      success: true,
      empleado: req.user
    });
  }
  return res.json({
    success: false,
    message: 'Empleado no autenticado'
  });
});

// API para obtener Empleados (JSON)
router.get('/api/empleados', isLoggedIn, async (req, res) => {
  try {
    const [empleados] = await pool.query(`
      SELECT e.Cod_Empleado, e.Nombre, e.Apellido, e.Direccion, e.Estado,
             t.Numero AS Telefono, t.Compania
      FROM Empleado e
      LEFT JOIN Telefono t ON e.Cod_Empleado = t.Cod_Empleado
    `);

    res.json({ 
      success: true, 
      data: empleados 
    });
  } catch (error) {
    console.error("Error al obtener empleados:", error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener empleados' 
    });
  }
});

router.put('/api/empleados/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, direccion, estado, telefono, compania } = req.body;

  try {
    // Validación de datos
    const validationErrors = validateEmpleadoData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: validationErrors 
      });
    }

    // Iniciar transacción
    await pool.query('START TRANSACTION');

    try {
      // 1. Actualizar datos del empleado
      await pool.query(
        `UPDATE Empleado 
         SET Nombre = ?, Apellido = ?, Direccion = ?, Estado = ?
         WHERE Cod_Empleado = ?`,
        [nombre, apellido, direccion, estado, id]
      );

      // 2. Buscar teléfono actual del empleado
      const [telefonoActual] = await pool.query(
        `SELECT Numero FROM Telefono WHERE Cod_Empleado = ?`,
        [id]
      );

      // 3. Manejar el teléfono según exista o no
      if (telefonoActual.length > 0) {
        // Si el número cambió, eliminar el antiguo primero
        if (telefonoActual[0].Numero !== telefono) {
          await pool.query(
            `DELETE FROM Telefono WHERE Numero = ?`,
            [telefonoActual[0].Numero]
          );
        }
        // Insertar/actualizar el nuevo número
        await pool.query(
          `INSERT INTO Telefono (Numero, Compania, Cod_Empleado, Cod_Proveedor)
           VALUES (?, ?, ?, NULL)
           ON DUPLICATE KEY UPDATE Compania = ?, Cod_Empleado = ?`,
          [telefono, compania, id, compania, id]
        );
      } else {
        // Si no tenía teléfono, insertar nuevo
        await pool.query(
          `INSERT INTO Telefono (Numero, Compania, Cod_Empleado, Cod_Proveedor)
           VALUES (?, ?, ?, NULL)`,
          [telefono, compania, id]
        );
      }

      await pool.query('COMMIT');
      res.json({ success: true, message: 'Empleado actualizado correctamente' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Error al actualizar empleado:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Error al actualizar empleado"
    });
  }
});

// Mantenemos la ruta original para compatibilidad
router.put('/empleados/add', async (req, res) => {
  // Redirigir a la nueva ruta API
  const { codigoEmpleado, ...rest } = req.body;
  req.params = { id: codigoEmpleado };
  req.body = rest;
  return router.handle(req, res);
});

export { router };