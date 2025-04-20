import express from "express";
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Helper para validar datos del Empleado
const validateEmpleadoData = (data, isUpdate = false) => {
  const { nombre, apellido, direccion, telefono, compania, cedula } = data;
  const errors = [];

  // Solo validamos estos campos si no es una actualización
  if (!isUpdate) {
    if (!nombre || nombre.length < 2) {
      errors.push("El nombre es requerido (mínimo 2 caracteres)");
    }
    if (!apellido || apellido.length < 2) {
      errors.push("El apellido es requerido (mínimo 2 caracteres)");
    }
    if (!cedula || !/^[0-9]{13}[A-Z]$/i.test(cedula)) {
      errors.push("La cédula debe tener 13 dígitos seguidos de 1 letra");
    }
  }

  // Estos campos siempre se validan (tanto en creación como actualización)
  if (!direccion || direccion.length < 5) {
    errors.push("La dirección es requerida (mínimo 5 caracteres)");
  }
  if (!telefono) {
    errors.push("El teléfono es requerido");
  }

  const companiasValidas = ['Tigo', 'Claro'];
  if (!compania || !companiasValidas.includes(compania)) {
    errors.push(`La compañía debe ser una de: ${companiasValidas.join(', ')}`);
  }

  return errors;
};

// Mostrar formulario de añadir Empleado
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    const [Empleados] = await pool.query(`
      SELECT Cod_Empleado, Nombre, Apellido 
      FROM Empleado
      WHERE Estado = 'Activo'
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
  const { nombre, apellido, direccion, estado, telefono, compania, cedula } = req.body;

  try {
    const validationErrors = validateEmpleadoData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: validationErrors 
      });
    }

    // Usar la fecha actual del sistema
    const fechaIngreso = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Insertar en Empleado
    const [empleadoResult] = await pool.query(
      'INSERT INTO Empleado (Nombre, Apellido, Direccion, Estado, Cedula, FechaIngreso) VALUES (?, ?, ?, ?, ?, ?)', 
      [nombre, apellido, direccion, estado, cedula.toUpperCase(), fechaIngreso]
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

function getLocalDate() {
  const now = new Date();
  // Ajustar para zona horaria específica (ejemplo para UTC-4)
  const offset = -4 * 60; // 4 horas en minutos
  now.setMinutes(now.getMinutes() + offset);
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

// Usar al insertar/modificar
const fechaActual = getLocalDate();

// API para obtener Empleados (JSON)
// En tu archivo de rutas (router.js), modifica el endpoint API
router.get('/api/empleados', isLoggedIn, async (req, res) => {
  try {
    const [empleados] = await pool.query(`
      SELECT 
        e.Cod_Empleado, 
        e.Nombre, 
        e.Apellido, 
        e.Direccion, 
        e.Estado, 
        e.Cedula,
        e.FechaIngreso,
        DATE_FORMAT(e.FechaIngreso, '%d/%m/%Y') AS FechaIngresoFormateada,
        t.Numero AS Telefono, 
        t.Compania
      FROM Empleado e
      LEFT JOIN Telefono t ON e.Cod_Empleado = t.Cod_Empleado
      WHERE e.Estado = 'Activo'
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


router.put('/api/empleados/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { direccion, estado, telefono, compania, resetPassword } = req.body;

  try {
    // Validar datos (sin incluir nombre, apellido ni cédula)
    const validationErrors = validateEmpleadoData(req.body, true); // Pasamos false para indicar que no validemos esos campos
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        errors: validationErrors 
      });
    }

    // Iniciar transacción
    await pool.query('START TRANSACTION');

    // Construir consulta SQL dinámica para Empleado (sin incluir nombre, apellido ni cédula)
    const empleadoFields = [];
    const empleadoValues = [];

    if (direccion !== undefined) {
      empleadoFields.push('Direccion = ?');
      empleadoValues.push(direccion);
    }
    if (estado !== undefined) {
      empleadoFields.push('Estado = ?');
      empleadoValues.push(estado);
    }
    if (resetPassword) {
      empleadoFields.push('Contraseña = ?');
      empleadoValues.push('1234'); // Establecer contraseña temporal
    }

    // Actualizar empleado si hay campos para modificar
    if (empleadoFields.length > 0) {
      const query = `UPDATE Empleado SET ${empleadoFields.join(', ')} WHERE Cod_Empleado = ?`;
      await pool.query(query, [...empleadoValues, id]);
    }

    // Actualizar teléfono si se proporcionó
    if (telefono !== undefined && compania !== undefined) {
      await pool.query(
        `UPDATE Telefono SET Numero = ?, Compania = ? WHERE Cod_Empleado = ?`,
        [telefono, compania, id]
      );
    }

    // Confirmar transacción
    await pool.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Empleado actualizado correctamente',
      passwordReset: resetPassword || false
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Error al actualizar empleado:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Error al actualizar empleado"
    });
  }
});
export { router };
