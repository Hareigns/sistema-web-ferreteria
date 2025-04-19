import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

// Estrategia de autenticación usando Cod_Empleado y Contraseña
passport.use('local.login', new LocalStrategy({
    usernameField: 'codigo_empleado',
    passwordField: 'password',
    passReqToCallback: false // Ya no necesitamos la request completa
}, async (codigo_empleado, password, done) => {
    try {
        // Consulta solo empleados activos
        const [rows] = await pool.query(
            'SELECT * FROM empleado WHERE Cod_Empleado = ? AND Estado = "Activo"', 
            [codigo_empleado]
        );
        console.log('Resultado de la consulta:', rows);

        if (rows.length > 0) {
            const empleado = rows[0];
            
            // Comparación de la contraseña (sin hash por ahora, ya que es temporal)
            if (empleado.Contraseña === password) {
                console.log('Contraseña válida');
                done(null, empleado, { message: `¡Bienvenido ${empleado.Nombre} ${empleado.Apellido}!` });
            } else {
                console.log('Contraseña incorrecta');
                done(null, false, { message: 'Código de empleado o contraseña incorrectos' });
            }
        } else {
            console.log('Empleado no encontrado o inactivo');
            return done(null, false, { message: 'Empleado no encontrado o inactivo' });
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        return done(error);
    }
}));

// Serialización de usuario (se guarda el Cod_Empleado en la sesión)
passport.serializeUser((empleado, done) => {
    done(null, empleado.Cod_Empleado);
});

// Deserialización del usuario
passport.deserializeUser(async (Cod_Empleado, done) => {
    try {
        const [rows] = await pool.query('SELECT * FROM empleado WHERE Cod_Empleado = ?', [Cod_Empleado]);
        if (rows.length > 0) {
            const empleado = rows[0];
            done(null, empleado);
        } else {
            done(new Error('Empleado no encontrado'));
        }
    } catch (error) {
        done(error);
    }
});

// Agrega el middleware de autenticación
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const [rows] = await pool.query('SELECT * FROM empleado WHERE username = ? AND password = ?', [username, password]);
            if (rows.length > 0) {
                return done(null, rows[0]);
            } else {
                return done(null, false, { message: 'Credenciales incorrectas' });
            }
        } catch (error) {
            return done(error);
        }
    }
));

export default passport;
