import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

// Estrategia de autenticación usando Cod_Empleado, Nombre y Apellido
passport.use('local.login', new LocalStrategy({
    usernameField: 'codigo_empleado', // Campo del formulario
    passwordField: 'nombre',          // Este campo no se usa realmente, pero es necesario para la estrategia
    passReqToCallback: true
}, async (req, codigo_empleado, nombre, done) => {
    try {
        //console.log('Autenticando empleado:', codigo_empleado);

        // Busca el empleado en la base de datos
        const [rows] = await pool.query('SELECT * FROM empleado WHERE Cod_Empleado = ?', [codigo_empleado]);
        console.log('Resultado de la consulta:', rows);

        if (rows.length > 0) {
            const empleado = rows[0]; // Accede directamente al primer registro
            //console.log('Empleado encontrado:', empleado);

            // Verifica que el nombre y apellido coincidan sin importar mayúsculas o minúsculas
            if (empleado.Nombre.toLowerCase() === req.body.nombre.toLowerCase() && 
                empleado.Apellido.toLowerCase() === req.body.apellido.toLowerCase()) {
                console.log('Nombre y apellido válidos');
                done(null, empleado, req.flash('success', '¡Bienvenido ' + empleado.Nombre + ' ' + empleado.Apellido + '!'));
            } else {
                console.log('Nombre o apellido incorrecto');
                done(null, false, req.flash('error', 'Nombre o apellido incorrecto'));
            }
        } else {
            console.log('Empleado no encontrado');
            return done(null, false, req.flash('error', 'Empleado no encontrado'));
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



/*
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import helpers from "./helpers.js";
import pool from "../database.js";

passport.use('local.login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, username, password, done) => {
    try {
        const rows = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length > 0) {
            const user = rows[0][0];
            const validPassword = await helpers.matchPassword(password, user.password);

            if (validPassword) {
                done(null, user, req.flash('success', '¡Bienvenido ' + user.username + '!'));
            } else {
                done(null, false, req.flash('error', 'Contraseña incorrecta'));
            }
        } else {
            return done(null, false, req.flash('error', 'Usuario no encontrado'));
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        return done(error);
    }
}));

passport.use('local.register', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, username, password, done) => {
    try {
        const { fullname } = req.body;
        const newUser = { username, password, fullname };

        newUser.password = await helpers.encryptPassword(password);
        const result = await pool.query('INSERT INTO users SET ?', [newUser]);
        newUser.id = result[0].insertId;

        return done(null, newUser);
    } catch (error) {
        console.error("Error en el registro:", error);
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, result[0]);
    } catch (error) {
        console.error("Error al deserializar usuario:", error);
        done(error);
    }
});
*/