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
      if (!new_password) {
        req.flash('error', 'Debe establecer una nueva contraseña');
        return res.redirect('/login');
      }

      if (new_password !== confirm_password) {
        req.flash('error', 'Las contraseñas no coinciden');
        return res.redirect('/login');
      }

      if (new_password.length < 6) {
        req.flash('error', 'La contraseña debe tener al menos 6 caracteres');
        return res.redirect('/login');
      }

      // Actualizar la contraseña en la base de datos
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(new_password, salt);

const [result] = await pool.query(
    'UPDATE Empleado SET Contraseña = ? WHERE Cod_Empleado = ?',
    [hashedPassword, codigo_empleado]
);

      if (result.affectedRows === 0) {
        req.flash('error', 'Empleado no encontrado');
        return res.redirect('/login');
      }

      req.body.password = new_password;
    }

    // Autenticación con Passport
    passport.authenticate('local.login', (err, user, info) => {
      if (err) {
        console.error('Error en autenticación:', err);
        return next(err);
      }
      if (!user) {
        req.flash('error', info.message || 'Error de autenticación');
        return res.redirect('/login');
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error('Error en login:', err);
          return next(err);
        }
        return res.redirect('/dashboard');
      });
    })(req, res, next);

  } catch (error) {
    console.error('Error en el proceso de login:', error);
    req.flash('error', 'Error al procesar la solicitud');
    res.redirect('/login');
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

export default router; 