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


import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import pool from "../database.js";

// Estrategia de autenticación usando Cod_Empleado, Nombre y Apellido
passport.use('local.login', new LocalStrategy({
    usernameField: 'codigo_empleado',
    passwordField: 'nombre', // Aquí lo usamos temporalmente porque la estrategia de Passport requiere un segundo campo
    passReqToCallback: true
}, async (req, codigo_empleado, nombre, done) => {
    try {
        const { apellido } = req.body;

        console.log('Autenticando empleado:', codigo_empleado);

        // Buscar en la tabla Empleado
        const [rows] = await pool.query('SELECT * FROM Empleado WHERE Cod_Empleado = ? AND Nombre = ? AND Apellido = ?', 
            [codigo_empleado, nombre, apellido]);

        if (rows.length > 0) {
            const empleado = rows[0];
            console.log('Empleado encontrado:', empleado);
            done(null, empleado, req.flash('success', '¡Bienvenido ' + empleado.Nombre + '!'));
        } else {
            console.log('Empleado no encontrado');
            done(null, false, req.flash('error', 'Código, nombre o apellido incorrectos'));
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        return done(error);
    }
}));

// Serialización del empleado
passport.serializeUser((empleado, done) => {
    console.log('Serializando empleado con ID:', empleado.Cod_Empleado);
    done(null, empleado.Cod_Empleado);
});

// Deserialización del empleado
passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializando empleado con ID:', id);
        const [rows] = await pool.query('SELECT * FROM Empleado WHERE Cod_Empleado = ?', [id]);

        if (rows.length > 0) {
            const empleado = rows[0];
            done(null, empleado);
        } else {
            done(new Error('Empleado no encontrado'));
        }
    } catch (error) {
        console.error("Error al deserializar empleado:", error);
        done(error);
    }
});

export default passport;
