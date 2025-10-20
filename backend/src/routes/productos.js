import express from 'express';
import pool from '../database.js';
import { isLoggedIn } from "../lib/auth.js";
import sharp from 'sharp'; 
import { supabase } from '../supabase.js'; // ✅ Solo una importación

const router = express.Router();

// Datos de sectores
const SECTORES = [
  "Herramientas manuales", "Herramientas eléctricas", 
  "Materiales de construcción", "Pinturas o accesorios",
  "Tuberías y plomería", "Electricidad e iluminación",
  "Seguridad industrial", "Productos de ferretería general"
];

// ========== FUNCIONES PARA SUPABASE ==========

// Función mejorada para subir imagen a Supabase
const uploadImageToSupabase = async (imageBuffer, codigoProducto, mimeType = 'image/webp') => {
  try {
    // Verificar que el buffer no esté vacío
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Buffer de imagen vacío');
    }

    // Generar nombre único para la imagen
    const timestamp = Date.now();
    const filename = `producto_${codigoProducto}_${timestamp}.webp`;
    const filePath = `productos/${filename}`;

    console.log('Subiendo imagen a Supabase:', {
      filePath,
      bufferSize: imageBuffer.length,
      mimeType
    });

    // Verificar que Supabase esté configurado correctamente
    if (!supabase) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Subir la imagen a Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, imageBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600'
      });

    if (error) {
      console.error('Error detallado de Supabase:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        statusCode: error.statusCode
      });
      
      if (error.message.includes('JWS') || error.message.includes('auth')) {
        throw new Error('Error de autenticación con Supabase. Verifica SUPABASE_ANON_KEY');
      }
      
      throw new Error(`Error al subir imagen: ${error.message}`);
    }

    console.log('Imagen subida exitosamente:', data);

    // Obtener URL pública de la imagen
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    if (!urlData.publicUrl) {
      throw new Error('No se pudo obtener la URL pública de la imagen');
    }

    console.log('URL pública generada:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error en uploadImageToSupabase:', error);
    throw new Error('Error al procesar y subir la imagen: ' + error.message);
  }
};

// Función mejorada para procesar Base64
const processBase64Image = async (base64String, codigoProducto) => {
  try {
    console.log('Procesando imagen Base64, longitud:', base64String.length);
    
    // Validaciones más estrictas del Base64
    if (!base64String || base64String.length < 100) {
      throw new Error('String Base64 inválido o demasiado corto');
    }

    // Extraer el contenido Base64 con mejor manejo de errores
    const base64Regex = /^data:image\/([a-zA-Z]*);base64,(.*)$/;
    const matches = base64String.match(base64Regex);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Formato Base64 inválido. Debe ser: data:image/[tipo];base64,...');
    }

    const imageType = matches[1];
    const base64Data = matches[2];
    
    // Validar que los datos Base64 no estén corruptos
    if (!base64Data || base64Data.length < 50) {
      throw new Error('Datos Base64 insuficientes');
    }

    console.log('Tipo de imagen detectado:', imageType);
    console.log('Datos Base64 longitud:', base64Data.length);

    try {
      const imageBuffer = Buffer.from(base64Data, 'base64');
      console.log('Buffer creado, tamaño:', imageBuffer.length);

      if (imageBuffer.length === 0) {
        throw new Error('Buffer convertido está vacío');
      }

      return await processImage(imageBuffer, codigoProducto);
    } catch (bufferError) {
      throw new Error('Error al convertir Base64 a buffer: ' + bufferError.message);
    }
  } catch (error) {
    console.error('Error procesando imagen Base64:', error);
    throw new Error('Error al procesar la imagen Base64: ' + error.message);
  }
};

// Función para procesar imágenes con Sharp y subir a Supabase
const processImage = async (imageBuffer, codigoProducto) => {
  try {
    console.log('Procesando imagen para producto:', codigoProducto);
    console.log('Tamaño del buffer:', imageBuffer.length);

    // Procesar imagen con sharp
    const processedImageBuffer = await sharp(imageBuffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    console.log('Imagen procesada, tamaño:', processedImageBuffer.length);

    // Subir a Supabase
    const imageUrl = await uploadImageToSupabase(processedImageBuffer, codigoProducto, 'image/webp');
    
    return imageUrl;
  } catch (error) {
    console.error('Error procesando imagen:', error);
    throw new Error('Error al procesar la imagen: ' + error.message);
  }
};


// Función para eliminar imagen anterior de Supabase
const deleteImageFromSupabase = async (imageUrl) => {
  try {
    if (!imageUrl) return;

    // Extraer el path del archivo de la URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = `productos/${fileName}`;

    console.log('Eliminando imagen anterior:', filePath);

    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) {
      console.error('Error eliminando imagen anterior:', error);
      // No lanzar error, solo loggear
    } else {
      console.log('Imagen anterior eliminada exitosamente');
    }
  } catch (error) {
    console.error('Error en deleteImageFromSupabase:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
};

// ========== RUTAS ==========

// Mostrar formulario de añadir Producto
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    res.render("productos/add", {
      title: "Agregar Producto",
      sectores: SECTORES,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error al cargar formulario:", error);
    req.flash("error", "Error al cargar el formulario");
    res.redirect("/productos");
  }
});

// Ruta para guardar productos (con sistema de lotes)
router.post("/api/productos", isLoggedIn, async (req, res) => {
  const { productos } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ success: false, message: "No se recibieron productos." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    for (const producto of productos) {
      const { 
        codigo_producto, nombre, marca, fecha_vencimiento, 
        sector, codigo_proveedor, precio_compra, 
        cantidad, fecha_entrada, ubicacion, descripcion,
        imagen_base64, imagen_nombre, imagen_tipo
      } = producto;

      // Validar campos obligatorios
      if (!codigo_producto || !nombre || !codigo_proveedor || !precio_compra || !cantidad) {
        throw new Error("Producto con datos incompletos");
      }

      const fechaVencimientoValida = fecha_vencimiento || null;
      const fechaEntradaValida = fecha_entrada || new Date().toISOString().split('T')[0];
      const descripcionFinal = descripcion || ubicacion || null;

      // DEBUG: Verificar si llega la imagen
      console.log('Producto:', codigo_producto);
      console.log('Tiene imagen_base64:', !!imagen_base64);
      console.log('Longitud base64:', imagen_base64 ? imagen_base64.length : 0);

      // Procesar imagen si existe (AHORA CON SUPABASE)
      let imagenUrl = null;
      if (imagen_base64 && imagen_base64.length > 0) {
        try {
          console.log('Procesando imagen para producto:', codigo_producto);
          imagenUrl = await processBase64Image(imagen_base64, codigo_producto);
          console.log('Imagen procesada, URL:', imagenUrl);
        } catch (imageError) {
          console.error(`Error procesando imagen para producto ${codigo_producto}:`, imageError);
          // Continuar sin imagen si hay error
        }
      }

      // Verificar si el producto ya existe
      const productoExistente = await client.query(
        'SELECT cod_producto FROM producto WHERE cod_producto = $1',
        [codigo_producto]
      );

      if (productoExistente.rows.length === 0) {
        // Insertar en tabla Producto si no existe
        console.log('Insertando nuevo producto con imagen_url:', imagenUrl);
        await client.query(
          `INSERT INTO producto (cod_producto, nombre, marca, fechavencimiento, sector, descripcion, estado, imagen_url)
           VALUES ($1, $2, $3, $4, $5, $6, 'Activo', $7)`,
          [codigo_producto, nombre, marca, fechaVencimientoValida, sector, descripcionFinal, imagenUrl]
        );
      } else {
        // Actualizar producto existente
        console.log('Actualizando producto existente con imagen_url:', imagenUrl);
        if (imagenUrl) {
          await client.query(
            `UPDATE producto SET 
             nombre = $1, marca = $2, fechavencimiento = $3, 
             sector = $4, descripcion = $5, imagen_url = $6
             WHERE cod_producto = $7`,
            [nombre, marca, fechaVencimientoValida, sector, descripcionFinal, imagenUrl, codigo_producto]
          );
        } else {
          // Actualizar sin cambiar la imagen
          await client.query(
            `UPDATE producto SET 
             nombre = $1, marca = $2, fechavencimiento = $3, 
             sector = $4, descripcion = $5
             WHERE cod_producto = $6`,
            [nombre, marca, fechaVencimientoValida, sector, descripcionFinal, codigo_producto]
          );
        }
      }

      // Insertar NUEVO LOTE en la tabla lotes_producto
      await client.query(
        `INSERT INTO lotes_producto (cod_proveedor, cod_producto, fecha_entrada, precio, cantidad, cantidad_disponible)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [codigo_proveedor, codigo_producto, fechaEntradaValida, precio_compra, cantidad, cantidad]
      );
    }

    await client.query('COMMIT');
    res.json({ 
      success: true, 
      message: "Productos registrados exitosamente",
      productos_con_imagen: productos.filter(p => p.imagen_base64 && p.imagen_base64.length > 0).length
    });

  } catch (error) {
    await client?.query('ROLLBACK');
    console.error("Error al registrar productos:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client?.release();
  }
});

// Ruta para obtener el stock actual de un producto (SOLO lotes_producto)
router.get("/api/stock-producto/:codigo", isLoggedIn, async (req, res) => {
  const { codigo } = req.params;
  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT COALESCE(SUM(cantidad_disponible), 0) as stock_total
      FROM lotes_producto 
      WHERE cod_producto = $1
    `, [codigo]);
    
    const stockTotal = parseInt(result.rows[0].stock_total) || 0;
    
    res.json({ success: true, stock: stockTotal });
  } catch (error) {
    console.error("Error al obtener stock:", error);
    res.status(500).json({ success: false, message: "Error al obtener stock del producto" });
  } finally {
    client?.release();
  }
});

// Ruta para obtener productos activos con stock (SOLO lotes_producto)
router.get("/api/productos-activos", isLoggedIn, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        p.cod_producto, 
        p.nombre, 
        p.marca,
        -- SUMA REAL de todos los lotes disponibles
        COALESCE(SUM(lp.cantidad_disponible), 0) as cantidad,
        COALESCE(
          (SELECT lp2.precio 
           FROM lotes_producto lp2 
           WHERE lp2.cod_producto = p.cod_producto 
           ORDER BY lp2.fecha_entrada DESC, lp2.id_lote DESC 
           LIMIT 1), 0
        ) as precio_compra
      FROM producto p
      LEFT JOIN lotes_producto lp ON p.cod_producto = lp.cod_producto
      WHERE p.estado = 'Activo'
      GROUP BY p.cod_producto, p.nombre, p.marca
      HAVING COALESCE(SUM(lp.cantidad_disponible), 0) > 0
      ORDER BY p.nombre
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error al obtener productos activos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos activos" });
  } finally {
    client?.release();
  }
});

// Ruta para registrar una baja de producto (usando sistema FIFO con lotes)
router.post('/api/productos/baja', isLoggedIn, async (req, res) => {
    const { codigo_producto, motivo, cantidad, observaciones } = req.body;
    let client;
    
    try {
        // Validación básica
        if (!codigo_producto || !motivo || !cantidad) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos requeridos deben estar completos'
            });
        }

        const qty = parseInt(cantidad);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La cantidad debe ser un número válido mayor a cero'
            });
        }

        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Obtener lotes disponibles (orden FIFO: más antiguos primero)
        const lotes = await client.query(
            `SELECT * FROM lotes_producto 
             WHERE cod_producto = $1 AND cantidad_disponible > 0
             ORDER BY fecha_entrada ASC, id_lote ASC`,
            [codigo_producto]
        );

        if (!lotes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'No se encontró stock disponible para este producto'
            });
        }

        let cantidadRestante = qty;
        const lotesAfectados = [];

        // 2. Aplicar FIFO: descontar de los lotes más antiguos primero
        for (const lote of lotes.rows) {
            if (cantidadRestante <= 0) break;

            const cantidadADescontar = Math.min(cantidadRestante, lote.cantidad_disponible);
            
            // Actualizar el lote
            await client.query(
                `UPDATE lotes_producto 
                 SET cantidad_disponible = cantidad_disponible - $1
                 WHERE id_lote = $2`,
                [cantidadADescontar, lote.id_lote]
            );

            // Registrar la baja para este lote
            await client.query(
                `INSERT INTO bajasproductos 
                 (cod_producto, cod_proveedor, id_lote, fecha_salida_baja, fecha_baja, cantidad, motivo)
                 VALUES ($1, $2, $3, CURRENT_DATE, NOW(), $4, $5)`,
                [codigo_producto, lote.cod_proveedor, lote.id_lote, cantidadADescontar, 
                 motivo === 'Otro' && observaciones ? `${motivo}: ${observaciones}` : motivo]
            );

            cantidadRestante -= cantidadADescontar;
            lotesAfectados.push({
                lote: lote.id_lote,
                cantidad: cantidadADescontar
            });
        }

        // 3. Verificar si se pudo cumplir con toda la cantidad solicitada
        if (cantidadRestante > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Solo hay ${qty - cantidadRestante} unidades disponibles (se solicitó ${qty})`
            });
        }

        await client.query('COMMIT');
        
        return res.json({ 
            success: true,
            message: 'Baja registrada correctamente',
            lotes_afectados: lotesAfectados
        });
        
    } catch (error) {
        await client?.query('ROLLBACK');
        console.error('Error al registrar baja:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        client?.release();
    }
});

// Ruta para obtener todos los productos con información CORRECTA de stock
router.get("/api/productos", isLoggedIn, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        p.cod_producto, 
        p.nombre, 
        p.marca, 
        p.fechavencimiento, 
        p.sector, 
        p.descripcion,
        p.estado,
        p.imagen_url,
        -- PRIORIDAD: Stock de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT SUM(lp.cantidad_disponible) 
           FROM lotes_producto lp 
           WHERE lp.cod_producto = p.cod_producto),
          pp.cantidad,
          0
        ) as cantidad,
        -- PRIORIDAD: Precio de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT lp2.precio 
           FROM lotes_producto lp2 
           WHERE lp2.cod_producto = p.cod_producto 
           ORDER BY lp2.fecha_entrada DESC, lp2.id_lote DESC 
           LIMIT 1),
          pp.precio,
          0
        ) as precio_compra
      FROM producto p
      LEFT JOIN proveproduct pp ON p.cod_producto = pp.cod_producto
      ORDER BY p.cod_producto ASC
    `);

    console.log("Datos de productos:", result.rows);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  } finally {
    client?.release();
  }
});

// Ruta para obtener un producto específico por su código (VERSIÓN MEJORADA)
router.get("/api/productos/:codigo", isLoggedIn, async (req, res) => {
  let client;
  try {
    const { codigo } = req.params;
    client = await pool.connect();
    
    const query = `
      SELECT 
        p.cod_producto, 
        p.nombre, 
        p.marca, 
        p.fechavencimiento, 
        p.sector, 
        p.descripcion,
        p.estado,
        -- PRIORIDAD: Precio de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT lp.precio 
           FROM lotes_producto lp 
           WHERE lp.cod_producto = p.cod_producto 
           ORDER BY lp.fecha_entrada DESC, lp.id_lote DESC 
           LIMIT 1),
          pp.precio,
          0
        ) as precio_compra,
        -- PRIORIDAD: Stock de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT SUM(lp2.cantidad_disponible) 
           FROM lotes_producto lp2 
           WHERE lp2.cod_producto = p.cod_producto),
          pp.cantidad,
          0
        ) as cantidad,
        -- PRIORIDAD: Fecha de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT lp3.fecha_entrada 
           FROM lotes_producto lp3 
           WHERE lp3.cod_producto = p.cod_producto 
           ORDER BY lp3.fecha_entrada DESC, lp3.id_lote DESC 
           LIMIT 1),
          pp.fecha_entrada,
          CURRENT_DATE
        ) as fecha_entrada,
        -- PRIORIDAD: Proveedor de lotes_producto, si no hay, usar proveproduct
        COALESCE(
          (SELECT lp4.cod_proveedor 
           FROM lotes_producto lp4 
           WHERE lp4.cod_producto = p.cod_producto 
           ORDER BY lp4.fecha_entrada DESC, lp4.id_lote DESC 
           LIMIT 1),
          pp.cod_proveedor,
          NULL
        ) as cod_proveedor,
        pr.nombre as proveedor_nombre,
        pr.apellido as proveedor_apellido
      FROM producto p
      LEFT JOIN proveproduct pp ON p.cod_producto = pp.cod_producto
      LEFT JOIN proveedor pr ON COALESCE(
        (SELECT lp5.cod_proveedor 
         FROM lotes_producto lp5 
         WHERE lp5.cod_producto = p.cod_producto 
         ORDER BY lp5.fecha_entrada DESC, lp5.id_lote DESC 
         LIMIT 1),
        pp.cod_proveedor
      ) = pr.cod_proveedor
      WHERE p.cod_producto = $1
    `;

    const result = await client.query(query, [codigo]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    const producto = result.rows[0];
    
    res.json({ 
      success: true, 
      data: producto 
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener producto" 
    });
  } finally {
    client?.release();
  }
});

// Ruta para actualizar un producto (agregando nuevo lote) - VERSIÓN MEJORADA
router.put("/api/productos/:codigo", isLoggedIn, async (req, res) => {
  const { codigo } = req.params;
  const { precio_compra, cantidad, descripcion, fecha_vencimiento } = req.body;
  let client;

  // Validaciones básicas
  if (!codigo) {
    return res.status(400).json({ 
      success: false, 
      message: "Código de producto inválido" 
    });
  }

  if (typeof precio_compra !== 'number' || precio_compra <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Precio debe ser un número mayor a 0" 
    });
  }

  if (typeof cantidad !== 'number' || cantidad <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Cantidad debe ser un número mayor a 0" 
    });
  }

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Obtener datos actuales del producto
    const productoQuery = await client.query(
      'SELECT * FROM producto WHERE cod_producto = $1',
      [codigo]
    );

    if (productoQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    const producto = productoQuery.rows[0];

    // 2. Obtener el proveedor (de proveproduct o lotes_producto)
    const proveedorQuery = await client.query(
      `SELECT cod_proveedor 
       FROM proveproduct 
       WHERE cod_producto = $1 
       ORDER BY fecha_entrada DESC 
       LIMIT 1`,
      [codigo]
    );

    if (proveedorQuery.rows.length === 0) {
      const loteProveedorQuery = await client.query(
        `SELECT cod_proveedor 
         FROM lotes_producto 
         WHERE cod_producto = $1 
         ORDER BY fecha_entrada DESC 
         LIMIT 1`,
        [codigo]
      );

      if (loteProveedorQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: "No se encontró proveedor para este producto" 
        });
      }
      var cod_proveedor = loteProveedorQuery.rows[0].cod_proveedor;
    } else {
      var cod_proveedor = proveedorQuery.rows[0].cod_proveedor;
    }

    // 3. Obtener STOCK ACTUAL TOTAL y PRECIO ANTERIOR
    const stockActualQuery = await client.query(
      `SELECT COALESCE(SUM(cantidad_disponible), 0) as stock_total
       FROM lotes_producto 
       WHERE cod_producto = $1`,
      [codigo]
    );

    const stock_actual = parseInt(stockActualQuery.rows[0].stock_total) || 0;

    // 4. Obtener PRECIO ANTERIOR (del último lote o proveproduct)
    const precioAnteriorQuery = await client.query(
      `SELECT COALESCE(
        (SELECT precio FROM lotes_producto 
         WHERE cod_producto = $1 
         ORDER BY fecha_entrada DESC, id_lote DESC 
         LIMIT 1),
        (SELECT precio FROM proveproduct 
         WHERE cod_producto = $1 
         ORDER BY fecha_entrada DESC 
         LIMIT 1),
        0
      ) as precio_anterior`,
      [codigo]
    );

    const precio_anterior = parseFloat(precioAnteriorQuery.rows[0].precio_anterior) || 0;

    // 5. Obtener fecha entrada anterior
    const fechaEntradaAnteriorQuery = await client.query(
      `SELECT COALESCE(
        (SELECT fecha_entrada FROM lotes_producto 
         WHERE cod_producto = $1 
         ORDER BY fecha_entrada DESC, id_lote DESC 
         LIMIT 1),
        (SELECT fecha_entrada FROM proveproduct 
         WHERE cod_producto = $1 
         ORDER BY fecha_entrada DESC 
         LIMIT 1),
        CURRENT_DATE
      ) as fecha_entrada_anterior`,
      [codigo]
    );

    const fecha_entrada_anterior = fechaEntradaAnteriorQuery.rows[0].fecha_entrada_anterior;

    // 6. Actualizar información del producto si es necesario
    if (descripcion || fecha_vencimiento) {
      await client.query(
        `UPDATE producto 
         SET descripcion = COALESCE($1, descripcion), 
             fechavencimiento = COALESCE($2, fechavencimiento)
         WHERE cod_producto = $3`,
        [descripcion, fecha_vencimiento, codigo]
      );
    }

    // 7. Insertar NUEVO LOTE con la nueva cantidad y precio
    await client.query(
      `INSERT INTO lotes_producto 
       (cod_proveedor, cod_producto, fecha_entrada, precio, cantidad, cantidad_disponible)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
      [cod_proveedor, codigo, precio_compra, cantidad, cantidad]
    );

    // 8. Actualizar también la tabla proveproduct
    await client.query(
      `INSERT INTO proveproduct 
       (cod_proveedor, cod_producto, fecha_entrada, precio, cantidad)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)
       ON CONFLICT (cod_proveedor, cod_producto) 
       DO UPDATE SET 
         fecha_entrada = EXCLUDED.fecha_entrada,
         precio = EXCLUDED.precio,
         cantidad = EXCLUDED.cantidad`,
      [cod_proveedor, codigo, precio_compra, cantidad]
    );

    // 9. Registrar en actualizacionesproductos (INCLUYENDO CAMBIOS DE PRECIO)
    await client.query(
      `INSERT INTO actualizacionesproductos 
       (cod_producto, precio_anterior, precio_nuevo, cantidad_anterior, cantidad_nueva,
        fecha_entrada_anterior, fecha_entrada_nueva, fechavencimiento_anterior, fechavencimiento_nueva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [codigo, precio_anterior, precio_compra, stock_actual, stock_actual + cantidad,
       fecha_entrada_anterior, new Date(), producto.fechavencimiento, fecha_vencimiento]
    );

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: "Nuevo lote agregado correctamente",
      datos: {
        stock_anterior: stock_actual,
        cantidad_agregada: cantidad,
        stock_nuevo: stock_actual + cantidad,
        precio_anterior: precio_anterior,
        precio_nuevo: precio_compra,
        cambio_precio: precio_anterior !== precio_compra
      }
    });

  } catch (error) {
    await client?.query('ROLLBACK');
    console.error("Error al agregar nuevo lote:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor",
      error: error.message 
    });
  } finally {
    client?.release();
  }
});

// Ruta para actualizar la imagen de un producto (MODIFICADA PARA SUPABASE)
router.put("/api/productos/:codigo/imagen", isLoggedIn, async (req, res) => {
  const { codigo } = req.params;
  const { imagen_base64, imagen_nombre, imagen_tipo } = req.body;

  let client;
  try {
    if (!codigo) {
      return res.status(400).json({
        success: false,
        message: "Código de producto inválido"
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Verificar que el producto existe y obtener imagen actual
    const productoExistente = await client.query(
      'SELECT cod_producto, imagen_url FROM producto WHERE cod_producto = $1',
      [codigo]
    );

    if (productoExistente.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado"
      });
    }

    const imagenUrlActual = productoExistente.rows[0].imagen_url;
    let nuevaImagenUrl = null;

    // Procesar nueva imagen si se proporciona
    if (imagen_base64 && imagen_base64.length > 0) {
      try {
        console.log('Procesando nueva imagen para producto:', codigo);
        nuevaImagenUrl = await processBase64Image(imagen_base64, codigo);
        console.log('Nueva imagen procesada, URL:', nuevaImagenUrl);

        // Eliminar imagen anterior si existe
        if (imagenUrlActual) {
          await deleteImageFromSupabase(imagenUrlActual);
        }
      } catch (imageError) {
        console.error(`Error procesando imagen para producto ${codigo}:`, imageError);
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: "Error al procesar la imagen: " + imageError.message
        });
      }
    }

    // Actualizar la imagen del producto
    await client.query(
      'UPDATE producto SET imagen_url = $1 WHERE cod_producto = $2',
      [nuevaImagenUrl, codigo]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Imagen actualizada correctamente",
      imagen_url: nuevaImagenUrl
    });

  } catch (error) {
    await client?.query('ROLLBACK');
    console.error("Error al actualizar imagen:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  } finally {
    client?.release();
  }
});

// Ruta para obtener ubicaciones
router.get("/api/ubicaciones", isLoggedIn, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(
      "SELECT DISTINCT descripcion FROM producto WHERE descripcion IS NOT NULL AND descripcion != ''"
    );
    
    res.json({
      success: true,
      data: result.rows.map(u => u.descripcion)
    });
  } catch (error) {
    console.error("Error al obtener ubicaciones:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener ubicaciones"
    });
  } finally {
    client?.release();
  }
});

// Ruta para obtener proveedores
router.get("/api/proveedores", isLoggedIn, async (req, res) => {
  let client;
  try {
    const { sector } = req.query;
    client = await pool.connect();
    
    let query = 'SELECT cod_proveedor, nombre, apellido, sector FROM proveedor WHERE estado = $1';
    const params = ['Activo'];
    
    if (sector) {
      query += ' AND sector = $2';
      params.push(sector);
    }
    
    const result = await client.query(query, params);
    
    // Formatear la respuesta como espera el frontend
    res.json({
      success: true,
      data: result.rows.map(p => ({
        codigo_proveedor: p.cod_proveedor,
        nombre: `${p.nombre} ${p.apellido}`,
        sector: p.sector
      }))
    });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener proveedores"
    });
  } finally {
    client?.release();
  }
});


// Ruta específica para el selector de productos (agregar a tu backend)
router.get("/api/productos-select", isLoggedIn, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT DISTINCT 
        p.cod_producto, 
        p.nombre, 
        p.marca
      FROM producto p
      WHERE p.estado = 'Activo'
      ORDER BY p.nombre ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error al obtener productos para selector:", error);
    res.status(500).json({ success: false, message: "Error al obtener productos" });
  } finally {
    client?.release();
  }
});

export { router }
