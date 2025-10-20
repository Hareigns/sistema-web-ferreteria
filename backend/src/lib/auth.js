// Verifica si el usuario está logueado
export function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
      // Asegurar que esAdmin esté definido
      if (req.user) {
        req.user.esAdmin = [1, 2].includes(req.user.cod_empleado);
      }
      return next();
    }
    req.flash('error', 'Por favor inicie sesión');
    res.redirect('/login');
}

// Verifica si es administrador
export function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user && [1, 2].includes(req.user.cod_empleado)) {
      return next();
    }
    req.flash('error', 'Acceso restringido a administradores');
    res.redirect('/dashboard');
}

export function isNotLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    return res.redirect('/dashboard');
}