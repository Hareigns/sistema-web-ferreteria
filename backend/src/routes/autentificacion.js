import express from "express";
import passport from "passport";
import { isLoggedIn, isNotLoggedIn } from "../lib/auth.js";
import pool from "../database.js"; // <-- Agrega esta línea
import bcrypt from "bcryptjs";

const router = express.Router();

// Ruta de login
router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('auth/login', { cssFile: 'login.css' });
});

// Procesar el formulario de login
router.post('/login', isNotLoggedIn, async (req, res, next) => {
  try {
    const { password, new_password, confirm_password, codigo_empleado } = req.body;

    // Verificación de contraseña temporal
    if (password === '1234') {
      // Verificar si realmente es la contraseña temporal (nuevo código)
      const [empleado] = await pool.query('SELECT Contraseña FROM Empleado WHERE Cod_Empleado = ?', [codigo_empleado]);
      
      if (empleado.length === 0) {
        return res.render('auth/login', {
          error: 'Empleado no encontrado',
          cssFile: 'login.css'
        });
      }

      const isTempPassword = await bcrypt.compare('1234', empleado[0].Contraseña);
      
      if (!isTempPassword) {
        return res.render('auth/login', {
          error: 'La contraseña temporal ya fue cambiada. Use su nueva contraseña.',
          cssFile: 'login.css'
        });
      }

      // Validaciones para cambio de contraseña
      if (!new_password) {
        return res.render('auth/login', {
          error: 'Debe establecer una nueva contraseña',
          cssFile: 'login.css'
        });
      }

      if (new_password !== confirm_password) {
        return res.render('auth/login', {
          error: 'Las contraseñas no coinciden',
          cssFile: 'login.css'
        });
      }

      if (new_password.length < 6) {
        return res.render('auth/login', {
          error: 'La contraseña debe tener al menos 6 caracteres',
          cssFile: 'login.css'
        });
      }

      // Actualizar la contraseña en la base de datos
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);

      const [result] = await pool.query(
        'UPDATE Empleado SET Contraseña = ? WHERE Cod_Empleado = ?',
        [hashedPassword, codigo_empleado]
      );

      if (result.affectedRows === 0) {
        return res.render('auth/login', {
          error: 'Error al actualizar la contraseña',
          cssFile: 'login.css'
        });
      }

      req.body.password = new_password;
    }

    // Autenticación con Passport - Versión modificada
    passport.authenticate('local.login', (err, user, info) => {
      if (err) {
        console.error('Error en autenticación:', err);
        return next(err);
      }
      if (!user) {
        return res.render('auth/login', { 
          error: info.message || 'Error de autenticación',
          cssFile: 'login.css'
        });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Error en login:', err);
          return next(err);
        }
        
        // Redirección basada en el rol del usuario
        if (user.esAdmin) {
          return res.redirect('/dashboard');
        } else {
          return res.redirect('/dashboardemple');
        }
      });
    })(req, res, next);

  } catch (error) {
    console.error('Error en el proceso de login:', error);
    return res.render('auth/login', {
      error: 'Error al procesar la solicitud',
      cssFile: 'login.css'
    });
  }
});


router.get('/dashboard', isLoggedIn, (req, res) => {
  console.log('Usuario en sesión:', req.user); // Debería mostrar los datos del usuario
  res.render('dashboard', {
    user: req.user // Usa req.user en lugar de req.session.user
  });
});


// Ruta para cerrar sesión
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return next(err);
    }

    // Destruir sesión y limpiar cookies
    req.session.destroy(err => {
      if (err) {
        console.error('Error al destruir la sesión:', err);
        return next(err);
      }
      res.clearCookie('connect.sid'); // Limpia la cookie de sesión
      res.redirect('/login');
    });
  });
});

// Middleware global de manejo de errores
router.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err);
  req.flash('error', 'Los datos ingresados son incorrectos.');
  return res.redirect('/login');
});


router.get('/api/usuario/actual', isLoggedIn, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'No autenticado' 
            });
        }
        
        res.json({
            success: true,
            Cod_Empleado: req.user.Cod_Empleado,
            Nombre: req.user.Nombre,
            Apellido: req.user.Apellido
        });
    } catch (error) {
        console.error('Error al obtener usuario actual:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener información del usuario' 
        });
    }
});

export default router; 