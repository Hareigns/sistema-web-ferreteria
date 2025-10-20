import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";
import bcrypt from "bcryptjs";

passport.use('local.login', new LocalStrategy(
    { usernameField: 'codigo_empleado', passwordField: 'password' },
    async (codigo_empleado, password, done) => {
      try {
        const result = await pool.query(
          'SELECT * FROM empleado WHERE cod_empleado = $1', 
          [codigo_empleado]
        );

        if (result.rows.length === 0) {
          return done(null, false, { message: 'Empleado no encontrado' });
        }

        const empleado = result.rows[0];
        
        if (empleado.estado !== 'Activo') {
          return done(null, false, { message: 'Empleado inactivo' });
        }
        
        // Verificar si es contraseña temporal
        if (password === '1234') {
          const isTempPassword = await bcrypt.compare('1234', empleado.contrasena);
          if (!isTempPassword) {
            return done(null, false, { 
              message: 'La contraseña temporal ya fue cambiada. Use su nueva contraseña.' 
            });
          }
          // Si es contraseña temporal, permitir login para que cambie la contraseña
          empleado.esAdmin = [1, 2].includes(empleado.cod_empleado);
          return done(null, empleado);
        }
        
        // Verificar contraseña normal
        const isMatch = await bcrypt.compare(password, empleado.contrasena);
        if (!isMatch) {
          return done(null, false, { message: 'Contraseña incorrecta' });
        }

        empleado.esAdmin = [1, 2].includes(empleado.cod_empleado);
        return done(null, empleado);
      } catch (error) {
        return done(error);
      }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.cod_empleado);
});

passport.deserializeUser(async (cod_empleado, done) => { 
  try {
    const result = await pool.query(
      'SELECT *, (cod_empleado IN (1, 2)) AS esadmin FROM empleado WHERE cod_empleado = $1', 
      [cod_empleado]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.esAdmin = [1, 2].includes(user.cod_empleado);
      done(null, user);
    } else {
      done(new Error('Empleado no encontrado'));
    }
  } catch (error) {
    done(error);
  }
});

export default passport;