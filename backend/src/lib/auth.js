// Verifica si el usuario está logueado
export function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
      // Añade el flag esAdmin al objeto user
      req.user.esAdmin = [1, 2].includes(req.user.Cod_Empleado);
      return next();
    }
    req.flash('error', 'Por favor inicie sesión');
    res.redirect('/login');
  }
  
  // Verifica si es administrador
  export function isAdmin(req, res, next) {
    if (req.isAuthenticated() && [1, 2].includes(req.user.Cod_Empleado)) {
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