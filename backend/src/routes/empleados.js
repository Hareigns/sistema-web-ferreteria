import express from "express";
import pool from "../database.js";
import { isLoggedIn } from "../lib/auth.js";
import bcrypt from "bcryptjs";

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

  // Validación condicional para updates
  if (data.direccion !== undefined && (!direccion || direccion.length < 5)) {
    errors.push("La dirección es requerida (mínimo 5 caracteres)");
  }

  if (data.telefono !== undefined && !telefono) {
    errors.push("El teléfono es requerido");
  }

  const companiasValidas = ['Tigo', 'Claro'];
  if (data.compania !== undefined && (!compania || !companiasValidas.includes(compania))) {
    errors.push(`La compañía debe ser: ${companiasValidas.join(', ')}`);
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

    // Verificar si la cédula ya existe
    if (await cedulaExiste(cedula.toUpperCase())) {
      return res.status(400).json({
        success: false,
        errors: ['La cédula ya está registrada para otro empleado']
      });
    }

    // Verificar si el teléfono ya existe
    if (await telefonoExiste(telefono)) {
      return res.status(400).json({
        success: false,
        errors: ['El número de teléfono ya está registrado para otro empleado o proveedor']
      });
    }    

    // Usar la fecha actual del sistema
    const fechaIngreso = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Hashear la contraseña por defecto
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('1234', salt);

    // Insertar en Empleado con la contraseña hasheada
    const [empleadoResult] = await pool.query(
      'INSERT INTO Empleado (Nombre, Apellido, Direccion, Estado, Cedula, FechaIngreso, Contraseña) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [nombre, apellido, direccion, estado, cedula.toUpperCase(), fechaIngreso, hashedPassword]
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

// API para obtener Empleados
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
      ORDER BY e.Cod_Empleado ASC
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


// Función helper para verificar teléfono
async function telefonoExiste(numero, excluirEmpleadoId = null) {
  try {
    let query = `
      SELECT COUNT(*) as count 
      FROM Telefono 
      WHERE Numero = ? 
      AND (Cod_Empleado != ? OR ? IS NULL)
    `;
    const params = [numero, excluirEmpleadoId, excluirEmpleadoId];
    
    const [result] = await pool.query(query, params);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    throw error;
  }
}

// Ruta PUT actualizada
router.put('/api/empleados/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { direccion, estado, telefono, compania, resetPassword } = req.body;

  try {
    // 1. Iniciar transacción
    await pool.query('START TRANSACTION');

    // 2. Verificar teléfono solo si se proporciona
    if (telefono) {
      const [current] = await pool.query(
        'SELECT Numero FROM Telefono WHERE Cod_Empleado = ?', 
        [id]
      );
      
      const telefonoActual = current[0]?.Numero;
      
      // Solo verificar si el teléfono cambió
      if (telefono !== telefonoActual) {
        const [existente] = await pool.query(
          'SELECT 1 FROM Telefono WHERE Numero = ? AND Cod_Empleado != ? LIMIT 1',
          [telefono, id]
        );
        
        if (existente.length > 0) {
          await pool.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            errors: ['El teléfono ya está registrado para otro empleado']
          });
        }
      }
    }

    // 3. Actualizar dirección y estado del empleado
    await pool.query(
      'UPDATE Empleado SET Direccion = ?, Estado = ? WHERE Cod_Empleado = ?',
      [direccion, estado, id]
    );

    // 4. Actualizar teléfono y compañía
    if (telefono) {
      await pool.query(
        'UPDATE Telefono SET Numero = ?, Compania = ? WHERE Cod_Empleado = ?',
        [telefono, compania, id]
      );
    }

    // 5. Resetear contraseña si se solicita
    if (resetPassword) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('1234', salt);
      
      await pool.query(
        'UPDATE Empleado SET Contraseña = ? WHERE Cod_Empleado = ?',
        [hashedPassword, id]
      );
    }

    await pool.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: resetPassword 
        ? 'Datos actualizados y contraseña restablecida' 
        : 'Actualización exitosa' 
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        errors: ['Error: El número de teléfono ya existe']
      });
    }

    console.error('Error en PUT:', error);
    res.status(500).json({ 
      success: false,
      errors: ['Error interno del servidor']
    });
  }
});

router.get('/api/telefono/existe/:numero', isLoggedIn, async (req, res) => {
  try {
    const { numero } = req.params;
    const { excluirEmpleado } = req.query;
    
    if (!numero) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido'
      });
    }
    
    const existe = await telefonoExiste(numero, excluirEmpleado);
    
    res.json({
      success: true,
      existe,
      message: existe 
        ? 'El número de teléfono ya está registrado' 
        : 'El número de teléfono está disponible'
    });
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar teléfono'
    });
  }
});

// Helper para verificar si una cédula ya existe
async function cedulaExiste(cedula, excluirEmpleadoId = null) {
  try {
    let query = `
      SELECT COUNT(*) as count 
      FROM Empleado 
      WHERE Cedula = ? 
      ${excluirEmpleadoId ? 'AND Cod_Empleado != ?' : ''}
    `;
    
    const params = excluirEmpleadoId ? [cedula, excluirEmpleadoId] : [cedula];
    
    const [result] = await pool.query(query, params);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error al verificar cédula:', error);
    throw error;
  }
}

router.get('/api/cedula/existe/:cedula', isLoggedIn, async (req, res) => {
  try {
    const { cedula } = req.params;
    const { excluirEmpleado } = req.query;
    
    if (!cedula) {
      return res.status(400).json({
        success: false,
        error: 'Cédula requerida'
      });
    }
    
    const existe = await cedulaExiste(cedula, excluirEmpleado);
    
    res.json({
      success: true,
      existe,
      message: existe 
        ? 'La cédula ya está registrada' 
        : 'La cédula está disponible'
    });
  } catch (error) {
    console.error('Error al verificar cédula:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar cédula'
    });
  }
});

export { router };
