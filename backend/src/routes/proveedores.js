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
    const proveedores = await pool.query(`
      SELECT p.cod_proveedor, p.nombre, p.apellido, p.sector, 
             t.numero AS telefono, t.compania
      FROM proveedor p
      LEFT JOIN telefono t ON p.cod_proveedor = t.cod_proveedor
      ORDER BY p.nombre, p.apellido
    `);

    res.render("proveedores/list", {
      title: "Lista de Proveedores",
      proveedores: proveedores.rows,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al obtener lista de proveedores:", error);
    req.flash('error', 'Error al cargar lista de proveedores');
    res.redirect('/proveedores');
  }
});

// Ruta POST para agregar proveedor (modificada para usar JSON)
router.post("/add", isLoggedIn, async (req, res) => {
  const { nombre, apellido, sector, telefono, compania, estado } = req.body;

  const validationErrors = validateProveedorData(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ 
      success: false, 
      errors: validationErrors 
    });
  }

  const client = await pool.connect();
  
  try {
    // Verificar teléfono
    if (await telefonoExiste(telefono)) {
      return res.status(400).json({
        success: false,
        errors: ['El número de teléfono ya está registrado']
      });
    }

    await client.query('BEGIN');

    // Insertar proveedor
    const proveedorResult = await client.query(
      'INSERT INTO proveedor (nombre, apellido, sector, estado) VALUES ($1, $2, $3, $4) RETURNING cod_proveedor',
      [nombre, apellido, sector, estado]
    );

    const codProveedor = proveedorResult.rows[0].cod_proveedor;

    // Insertar teléfono
    await client.query(
      'INSERT INTO telefono (numero, compania, cod_proveedor) VALUES ($1, $2, $3)',
      [telefono, compania, codProveedor]
    );

    await client.query('COMMIT');
    
    // Obtener lista actualizada de proveedores
    const proveedores = await client.query(`
      SELECT p.cod_proveedor, p.nombre, p.apellido, p.sector, p.estado,
             t.numero AS telefono, t.compania
      FROM proveedor p
      LEFT JOIN telefono t ON p.cod_proveedor = t.cod_proveedor
      ORDER BY p.nombre, p.apellido
    `);

    return res.json({ 
      success: true,
      message: 'Proveedor agregado correctamente',
      data: proveedores.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al agregar proveedor:', error);
    return res.status(500).json({ 
      success: false,
      errors: ['Error al agregar proveedor'] 
    });
  } finally {
    client.release();
  }
});

// Obtener todos los proveedores (para select y tabla)
router.get('/api/proveedores', isLoggedIn, async (req, res) => {
  try {
    const proveedores = await pool.query(`
      SELECT p.cod_proveedor, p.nombre, p.apellido, p.sector, p.estado,
             t.numero AS telefono, t.compania
      FROM proveedor p
      LEFT JOIN telefono t ON p.cod_proveedor = t.cod_proveedor
      ORDER BY p.estado DESC, p.nombre ASC
    `);
    
    res.json({ 
      success: true,
      data: proveedores.rows 
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener proveedores' 
    });
  }
});

// Obtener un proveedor específico
router.get('/api/proveedores/:id', isLoggedIn, async (req, res) => {
  try {
    const proveedor = await pool.query(`
      SELECT p.*, t.numero AS telefono, t.compania
      FROM proveedor p
      LEFT JOIN telefono t ON p.cod_proveedor = t.cod_proveedor
      WHERE p.cod_proveedor = $1
    `, [req.params.id]);
    
    if (proveedor.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Proveedor no encontrado' 
      });
    }
    
    res.json({ 
      success: true,
      data: proveedor.rows[0] 
    });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener proveedor' 
    });
  }
});

// Ruta PUT actualizada para proveedores
router.put('/api/proveedores/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, sector, telefono, compania, estado } = req.body;

  const client = await pool.connect();
  
  try {
    // 1. Iniciar transacción
    await client.query('BEGIN');

    // 2. Verificar teléfono DENTRO de la transacción
    if (telefono) {
      const current = await client.query(
        'SELECT numero FROM telefono WHERE cod_proveedor = $1', 
        [id]
      );
      
      const telefonoActual = current.rows[0]?.numero;
      
      // Solo verificar si el teléfono cambió
      if (telefono !== telefonoActual) {
        const existente = await client.query(
          'SELECT 1 FROM telefono WHERE numero = $1 AND cod_proveedor != $2 LIMIT 1',
          [telefono, id]
        );
        
        if (existente.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            errors: ['El teléfono ya está registrado para otro proveedor']
          });
        }
      }
    }

    // 3. Actualizar Proveedor
    await client.query(
      'UPDATE proveedor SET nombre = $1, apellido = $2, sector = $3, estado = $4 WHERE cod_proveedor = $5',
      [nombre, apellido, sector, estado, id]
    );

    // 4. Actualizar Telefono
    await client.query(
      'UPDATE telefono SET numero = $1, compania = $2 WHERE cod_proveedor = $3',
      [telefono, compania, id]
    );

    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Proveedor actualizado exitosamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error.code === '23505') { // Código de violación de restricción única en PostgreSQL
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
  } finally {
    client.release();
  }
});

// Ruta para verificar teléfono (mejorada)
router.get('/api/telefono/existe/:numero', isLoggedIn, async (req, res) => {
  try {
    const { numero } = req.params;
    const { excluirProveedor } = req.query;
    
    if (!numero || !/^\d+$/.test(numero)) {
      return res.json({
        success: false,
        existe: false,
        message: 'Número inválido'
      });
    }

    let query = `
      SELECT COUNT(*) as count 
      FROM telefono 
      WHERE numero = $1 
      AND (cod_proveedor != $2 OR $2 IS NULL)
    `;
    
    const result = await pool.query(query, [numero, excluirProveedor || null]);
    
    return res.json({
      success: true,
      existe: parseInt(result.rows[0].count) > 0,
      message: parseInt(result.rows[0].count) > 0 
        ? 'Teléfono ya registrado' 
        : 'Teléfono disponible'
    });

  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    return res.status(500).json({
      success: false,
      existe: false,
      error: 'Error en el servidor'
    });
  }
});

// Función helper actualizada para verificar teléfono
async function telefonoExiste(numero, excluirEmpleadoId = null, excluirProveedorId = null) {
  try {
    let query = `
      SELECT COUNT(*) as count 
      FROM telefono 
      WHERE numero = $1 
      AND (cod_empleado != $2 OR $2 IS NULL)
      AND (cod_proveedor != $3 OR $3 IS NULL)
    `;
    const params = [numero, excluirEmpleadoId, excluirProveedorId];
    
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    throw error;
  }
}

export { router };