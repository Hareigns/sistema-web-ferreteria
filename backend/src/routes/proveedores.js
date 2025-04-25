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

  try {
    // Verificar teléfono
    if (await telefonoExiste(telefono)) {
      return res.status(400).json({
        success: false,
        errors: ['El número de teléfono ya está registrado']
      });
    }

    await pool.query('START TRANSACTION');

    // Insertar proveedor
    const [proveedorResult] = await pool.query(
      'INSERT INTO Proveedor (Nombre, Apellido, Sector, Estado) VALUES (?, ?, ?, ?)',
      [nombre, apellido, sector, estado]
    );

    // Insertar teléfono
    await pool.query(
      'INSERT INTO Telefono (Numero, Compania, Cod_Proveedor) VALUES (?, ?, ?)',
      [telefono, compania, proveedorResult.insertId]
    );

    await pool.query('COMMIT');
    
    // Obtener lista actualizada de proveedores
    const [proveedores] = await pool.query(`
      SELECT p.Cod_Proveedor, p.Nombre, p.Apellido, p.Sector, p.Estado,
             t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
      ORDER BY p.Nombre, p.Apellido
    `);

    return res.json({ 
      success: true,
      message: 'Proveedor agregado correctamente',
      data: proveedores
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error al agregar proveedor:', error);
    return res.status(500).json({ 
      success: false,
      errors: ['Error al agregar proveedor'] 
    });
  }
});
  

// Obtener todos los proveedores (para select y tabla)
router.get('/api/proveedores', isLoggedIn, async (req, res) => {
  try {
    const [proveedores] = await pool.query(`
      SELECT p.Cod_Proveedor, p.Nombre, p.Apellido, p.Sector, p.Estado,
             t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
      ORDER BY p.Estado DESC, p.Nombre ASC
    `);
    
    res.json({ 
      success: true,
      data: proveedores 
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
    const [proveedor] = await pool.query(`
      SELECT p.*, t.Numero AS Telefono, t.Compania
      FROM Proveedor p
      LEFT JOIN Telefono t ON p.Cod_Proveedor = t.Cod_Proveedor
      WHERE p.Cod_Proveedor = ?
    `, [req.params.id]);
    
    if (proveedor.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Proveedor no encontrado' 
      });
    }
    
    res.json({ 
      success: true,
      data: proveedor[0] 
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

  try {
    // 1. Iniciar transacción
    await pool.query('START TRANSACTION');

    // 2. Verificar teléfono DENTRO de la transacción
    if (telefono) {
      const [current] = await pool.query(
        'SELECT Numero FROM Telefono WHERE Cod_Proveedor = ?', 
        [id]
      );
      
      const telefonoActual = current[0]?.Numero;
      
      // Solo verificar si el teléfono cambió
      if (telefono !== telefonoActual) {
        const [existente] = await pool.query(
          'SELECT 1 FROM Telefono WHERE Numero = ? AND Cod_Proveedor != ? LIMIT 1',
          [telefono, id]
        );
        
        if (existente.length > 0) {
          await pool.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            errors: ['El teléfono ya está registrado para otro proveedor']
          });
        }
      }
    }

    // 3. Actualizar Proveedor
    await pool.query(
      'UPDATE Proveedor SET Nombre = ?, Apellido = ?, Sector = ?, Estado = ? WHERE Cod_Proveedor = ?',
      [nombre, apellido, sector, estado, id]
    );

    // 4. Actualizar Telefono
    await pool.query(
      'UPDATE Telefono SET Numero = ?, Compania = ? WHERE Cod_Proveedor = ?',
      [telefono, compania, id]
    );

    await pool.query('COMMIT');
    
    res.json({ success: true, message: 'Proveedor actualizado exitosamente' });

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
      FROM Telefono 
      WHERE Numero = ? 
      AND (Cod_Proveedor != ? OR ? IS NULL)
    `;
    
    const [result] = await pool.query(query, [numero, excluirProveedor || null, excluirProveedor || null]);
    
    return res.json({
      success: true,
      existe: result[0].count > 0,
      message: result[0].count > 0 
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
      FROM Telefono 
      WHERE Numero = ? 
      AND (Cod_Empleado != ? OR ? IS NULL)
      AND (Cod_Proveedor != ? OR ? IS NULL)
    `;
    const params = [numero, excluirEmpleadoId, excluirEmpleadoId, excluirProveedorId, excluirProveedorId];
    
    const [result] = await pool.query(query, params);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error al verificar teléfono:', error);
    throw error;
  }
}

export { router };
