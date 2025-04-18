import express from "express";
import passport from "passport";
import { isLoggedIn, isNotLoggedIn } from "../lib/auth.js";

const router = express.Router();

// Ruta de login
router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('auth/login', { cssFile: 'login.css' });
});

// Procesar el formulario de login
router.post('/login', isNotLoggedIn, (req, res, next) => {
  passport.authenticate('local.login', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true,
  })(req, res, next);
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