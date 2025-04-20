export function marcarRol(req, res, next) {
    if (req.user) {
      req.user.esAdmin = (req.user.Cod_Empleado === 1 || req.user.Cod_Empleado === 2);
    }
    next();
  }
  