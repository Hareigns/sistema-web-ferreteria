import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

passport.use('local.login', new LocalStrategy({
    usernameField: 'codigo_empleado',
    passwordField: 'password'
}, async (codigo_empleado, password, done) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM empleado 
             WHERE Cod_Empleado = ? 
             AND Estado = 'Activo'`,
            [codigo_empleado]
        );

        if (!rows.length) return done(null, false, { message: 'Credenciales inválidas' });

        const empleado = rows[0];
        
        // Comparación directa (reemplaza esto con bcrypt en producción)
        if (empleado.Contraseña !== password) {
            return done(null, false, { message: 'Contraseña incorrecta' });
        }

        return done(null, empleado);
    } catch (error) {
        return done(error);
    }
}));

// Serialización y deserialización (mantén las que ya tienes)
passport.serializeUser((user, done) => {
    done(null, user.Cod_Empleado);
});

passport.deserializeUser(async (Cod_Empleado, done) => {
    try {
        const [rows] = await pool.query('SELECT * FROM empleado WHERE Cod_Empleado = ?', [Cod_Empleado]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(new Error('Empleado no encontrado'));
        }
    } catch (error) {
        done(error);
    }
});

export default passport;
