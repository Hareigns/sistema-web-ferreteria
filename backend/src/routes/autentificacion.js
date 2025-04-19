import express from "express";
import passport from "passport";
import { isLoggedIn, isNotLoggedIn } from "../lib/auth.js";
import pool from "../database.js"; // <-- Agrega esta línea

const router = express.Router();

// Ruta de login
router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('auth/login', { cssFile: 'login.css' });
});

// Procesar el formulario de login
router.post('/login', isNotLoggedIn, async (req, res, next) => {
  try {
    const { password, new_password, confirm_password, codigo_empleado } = req.body;

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
      const [result] = await pool.query(
        'UPDATE Empleado SET Contraseña = ? WHERE Cod_Empleado = ?',
        [new_password, codigo_empleado]
      );

      if (result.affectedRows === 0) {
        req.flash('error', 'Empleado no encontrado');
        return res.redirect('/login');
      }

      // ✅ Importante: Cambiar req.body.password para que passport use la nueva contraseña
      req.body.password = new_password;
    }

    // Ahora autenticar normalmente con la nueva contraseña
    passport.authenticate('local.login', {
      successRedirect: '/dashboard',
      failureRedirect: '/login',
      failureFlash: true
    })(req, res, next);
    
  } catch (error) {
    console.error('Error en el proceso de login:', error);
    req.flash('error', 'Error al procesar la solicitud');
    res.redirect('/login');
  }
});


// Ruta del dashboard (requiere autenticación)
router.get('/dashboard', isLoggedIn, (req, res) => {
  console.log(req.user); // Verifica si contiene los datos del usuario
  res.render('dashboard');
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