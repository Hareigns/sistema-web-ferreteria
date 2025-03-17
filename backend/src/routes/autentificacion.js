import express from "express";
import passport from "passport";
import { isLoggedIn, isNotLoggedIn } from "../lib/auth.js";

const router = express.Router();

router.get('/register', isNotLoggedIn, (req, res) => {
  res.render('auth/register');
});

router.post('/register', isNotLoggedIn, (req, res, next) => {
  passport.authenticate('local.register', {
    successRedirect: '/dashboard',
    failureRedirect: '/register',
    failureFlash: true,
  })(req, res, next);
});

router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('auth/login' , { cssFile: 'login.css' });
});

router.post('/login', isNotLoggedIn, (req, res, next) => {
  passport.authenticate('local.login', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true,
  })(req, res, next);
});

router.get('/dashboard', isLoggedIn, (req, res) => {
  res.render('dashboard');
});

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return next(err);
    }
    res.redirect('/login');
  });
});

// Middleware de error global
router.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err);

  req.flash('error', 'Los datos ingresados son incorrectos.');
  return res.redirect('/login');
  //res.status(500).send('Error en el servidor');
});

export default router;