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
    const { rows: empleados } = await pool.query(`
      SELECT cod_empleado, nombre, apellido 
      FROM empleado
      WHERE estado = 'Activo'
      ORDER BY nombre, apellido
    `);

    res.render("Empleados/add", {
      title: "Agregar Empleado",
      Empleado: empleados,
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
    const { rows: empleados } = await pool.query(`
      SELECT e.cod_empleado, e.nombre, e.apellido, e.direccion, 
             t.numero AS telefono, t.compania
      FROM empleado e
      LEFT JOIN telefono t ON e.cod_empleado = t.cod_empleado
      ORDER BY e.nombre, e.apellido
    `);

    res.render("Empleados/list", {
      title: "Lista de Empleados",
      Empleados: empleados,
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
    const fechaIngreso = new Date();
    
    // Hashear la contraseña por defecto
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('1234', salt);

    // Insertar en Empleado con la contraseña hasheada
    const empleadoResult = await pool.query(
      'INSERT INTO empleado (nombre, apellido, direccion, estado, cedula, fechaingreso, contrasena) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING cod_empleado', 
      [nombre, apellido, direccion, estado, cedula.toUpperCase(), fechaIngreso, hashedPassword]
    );
    
    const codEmpleado = empleadoResult.rows[0].cod_empleado;

    // Insertar en Telefono
    await pool.query(
      'INSERT INTO telefono (numero, compania, cod_empleado) VALUES ($1, $2, $3)', 
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

// API para obtener Empleados
router.get('/api/empleados', isLoggedIn, async (req, res) => {
  try {
    const { rows: empleados } = await pool.query(`
      SELECT 
        e.cod_empleado, 
        e.nombre, 
        e.apellido, 
        e.direccion, 
        e.estado, 
        e.cedula,
        e.fechaingreso,
        TO_CHAR(e.fechaingreso, 'DD/MM/YYYY') AS fechaingresoformateada,
        t.numero AS telefono, 
        t.compania
      FROM empleado e
      LEFT JOIN telefono t ON e.cod_empleado = t.cod_empleado
      ORDER BY e.cod_empleado ASC
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
      FROM telefono 
      WHERE numero = $1 
      AND (cod_empleado != $2 OR $2 IS NULL)
    `;
    const params = [numero, excluirEmpleadoId];
    
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    throw error;
  }
}

// Ruta PUT actualizada
router.put('/api/empleados/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { direccion, estado, telefono, compania, resetPassword } = req.body;

  let client;
  try {
    // 1. Obtener cliente del pool
    client = await pool.connect();
    
    // 2. Iniciar transacción
    await client.query('BEGIN');

    // 3. Verificar teléfono solo si se proporciona
    if (telefono) {
      const currentResult = await client.query(
        'SELECT numero FROM telefono WHERE cod_empleado = $1', 
        [id]
      );
      
      const telefonoActual = currentResult.rows[0]?.numero;
      
      // Solo verificar si el teléfono cambió
      if (telefono !== telefonoActual) {
        const existenteResult = await client.query(
          'SELECT 1 FROM telefono WHERE numero = $1 AND cod_empleado != $2 LIMIT 1',
          [telefono, id]
        );
        
        if (existenteResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            errors: ['El teléfono ya está registrado para otro empleado']
          });
        }
      }
    }

    // 4. Actualizar dirección y estado del empleado
    await client.query(
      'UPDATE empleado SET direccion = $1, estado = $2 WHERE cod_empleado = $3',
      [direccion, estado, id]
    );

    // 5. Actualizar teléfono y compañía
    if (telefono) {
      await client.query(
        'UPDATE telefono SET numero = $1, compania = $2 WHERE cod_empleado = $3',
        [telefono, compania, id]
      );
    }

    // 6. Resetear contraseña si se solicita
    if (resetPassword) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('1234', salt);
      
      await client.query(
        'UPDATE empleado SET contrasena = $1 WHERE cod_empleado = $2',
        [hashedPassword, id]
      );
    }

    // 7. Commit de la transacción
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: resetPassword 
        ? 'Datos actualizados y contraseña restablecida' 
        : 'Actualización exitosa' 
    });

  } catch (error) {
    console.error('Error en PUT:', error);
    
    // Rollback en caso de error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }

    if (error.code === '23505') { // Violación de restricción única
      return res.status(400).json({
        success: false,
        errors: ['Error: El número de teléfono ya existe']
      });
    }

    // Manejar errores de conexión específicos
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        errors: ['Error de conexión con la base de datos. Intente nuevamente.']
      });
    }

    res.status(500).json({ 
      success: false,
      errors: ['Error interno del servidor']
    });
  } finally {
    // Liberar el cliente siempre
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Error al liberar cliente:', releaseError);
      }
    }
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
      FROM empleado 
      WHERE cedula = $1 
      ${excluirEmpleadoId ? 'AND cod_empleado != $2' : ''}
    `;
    
    const params = excluirEmpleadoId ? [cedula, excluirEmpleadoId] : [cedula];
    
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) > 0;
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