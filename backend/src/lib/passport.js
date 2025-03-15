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
import helpers from "./helpers.js";
import pool from "../database.js";

// Estrategia para el login
passport.use('local.login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, username, password, done) => {
    try {
        console.log('Autenticando usuario:', username);

        // Busca el usuario en la base de datos
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        console.log('Resultado de la consulta:', rows);

        if (rows.length > 0) {
            const user = rows[0]; // Accede directamente al primer registro
            console.log('Usuario encontrado:', user);

            // Verifica la contraseña
            const validPassword = await helpers.matchPassword(password, user.password);
            if (validPassword) {
                console.log('Contraseña válida');
                done(null, user, req.flash('success', '¡Bienvenido ' + user.username + '!'));
            } else {
                console.log('Contraseña incorrecta');
                done(null, false, req.flash('error', 'Contraseña incorrecta'));
            }
        } else {
            console.log('Usuario no encontrado');
            return done(null, false, req.flash('error', 'Usuario no encontrado'));
        }
    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        return done(error);
    }
}));

// Estrategia para el registro
passport.use('local.register', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, username, password, done) => {
    try {
        const { fullname } = req.body;
        const newUser = { username, password, fullname };

        // Encripta la contraseña
        newUser.password = await helpers.encryptPassword(password);

        // Guarda el usuario en la base de datos
        const [result] = await pool.query('INSERT INTO users SET ?', [newUser]);
        newUser.id = result.insertId;

        console.log('Usuario registrado:', newUser);
        return done(null, newUser);
    } catch (error) {
        console.error("Error en el registro:", error);
        return done(error);
    }
}));

// Serialización del usuario
passport.serializeUser((user, done) => {
    console.log('Serializando usuario con ID:', user.id);
    done(null, user.id);
});

// Deserialización del usuario
passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializando usuario con ID:', id);

        // Busca el usuario en la base de datos
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        console.log('Resultado de la deserialización:', rows);

        if (rows.length > 0) {
            const user = rows[0]; // Accede directamente al primer registro
            done(null, user);
        } else {
            done(new Error('Usuario no encontrado'));
        }
    } catch (error) {
        console.error("Error al deserializar usuario:", error);
        done(error);
    }
});

export default passport;