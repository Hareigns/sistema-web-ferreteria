import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

// Estrategia de autenticación usando Cod_Empleado, Nombre y Apellido
passport.use('local.login', new LocalStrategy({
    usernameField: 'codigo_empleado',
    passwordField: 'nombre',
    passReqToCallback: true
}, async (req, codigo_empleado, nombre, done) => {
    try {
        // Consulta solo empleados activos
        const [rows] = await pool.query(
            'SELECT * FROM empleado WHERE Cod_Empleado = ? AND Estado = "Activo"', 
            [codigo_empleado]
        );
        console.log('Resultado de la consulta:', rows);

        if (rows.length > 0) {
            const empleado = rows[0];

            // Comparación de nombre y apellido sin importar mayúsculas
            if (
                empleado.Nombre.toLowerCase() === req.body.nombre.toLowerCase() &&
                empleado.Apellido.toLowerCase() === req.body.apellido.toLowerCase()
            ) {
                console.log('Nombre y apellido válidos');
                done(null, empleado, req.flash('success', '¡Bienvenido ' + empleado.Nombre + ' ' + empleado.Apellido + '!'));
            } else {
                console.log('Nombre o apellido incorrecto');
                done(null, false, req.flash('error', 'Nombre o apellido incorrecto'));
            }
        } else {
            console.log('Empleado no encontrado o inactivo');
            return done(null, false, req.flash('error', 'Empleado no encontrado o inactivo'));
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

// Deserialización del usuario (se busca el empleado por Cod_Empleado para restaurar los datos en la sesión)
passport.deserializeUser(async (Cod_Empleado, done) => {
    try {
        //console.log("Deserializando empleado con Cod_Empleado:", Cod_Empleado);  // Verifica el Cod_Empleado
        const [rows] = await pool.query('SELECT * FROM empleado WHERE Cod_Empleado = ?', [Cod_Empleado]);
        if (rows.length > 0) {
            const empleado = rows[0];
            //console.log("Empleado encontrado:", empleado);  // Verifica si los datos del empleado están correctos
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
