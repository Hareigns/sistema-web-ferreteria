import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

passport.use('local.login', new LocalStrategy(
    { usernameField: 'codigo_empleado', passwordField: 'password' },
    async (codigo_empleado, password, done) => {
      try {
        const [result] = await pool.query('SELECT * FROM Empleado WHERE Cod_Empleado = ?', [codigo_empleado]);
  
        if (!result.length) {
          return done(null, false, { message: 'Empleado no encontrado' });
        }
  
        const empleado = result[0];
        
        // Verifica si el empleado está activo
        if (empleado.Estado !== 'Activo') {
          return done(null, false, { message: 'Cuenta inactiva' });
        }
        
        // Compara la contraseña (asegúrate que el campo coincida con tu DB)
        if (empleado.Contraseña !== password) {
          return done(null, false, { message: 'Contraseña incorrecta' });
        }
  
        return done(null, empleado);
      } catch (error) {
        return done(error);
      }
    }
));
  
  // Serialize y Deserialize de Passport
  passport.serializeUser((user, done) => {
    done(null, user.Cod_Empleado);  // Guardamos el ID del usuario (o algún identificador único)
  });
  

  passport.deserializeUser(async (Cod_Empleado, done) => {
    try {
      const [result] = await pool.query(
        'SELECT *, (Cod_Empleado IN (1, 2)) AS esAdmin FROM Empleado WHERE Cod_Empleado = ?', 
        [Cod_Empleado]
      );
      done(null, result[0]);
    } catch (error) {
      done(error);
    }
  });

  

export default passport;
