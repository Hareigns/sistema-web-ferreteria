export function marcarRol(req, res, next) {
    if (req.user) {
      req.user.esAdmin = (req.user.cod_empleado === 1 || req.user.cod_empleado === 2);
    }
    next();
  }
  