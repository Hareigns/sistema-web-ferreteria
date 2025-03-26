import express from "express";
import morgan from "morgan";
import { engine } from "express-handlebars";
import { join, dirname } from "path";
import session from "express-session";
import flash from "connect-flash";
import MySQLStoreFactory from "express-mysql-session";
import passport from "passport";
import { fileURLToPath } from "url";
import { database } from "./keys.js";
import cookieParser from 'cookie-parser';
import { Handlebars } from "./lib/handlebars.js"; // Importa Handlebars
import './lib/passport.js'; // Importa la configuración de Passport
import bodyParser from 'body-parser';

// Importación de rutas
import indexRoutes from "./routes/index.js";
import autentificacionRoutes from "./routes/autentificacion.js";
import { router as bodegaRoutes } from "./routes/bodega.js";
import { router as empleadosRoutes } from "./routes/empleados.js";
import { router as productosRoutes } from "./routes/productos.js";
import { router as proveedoresRoutes } from "./routes/proveedores.js";
import { router as ventasRoutes } from "./routes/ventas.js";

// Inicialización de la aplicación
const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const MySQLStore = MySQLStoreFactory(session);

// Configuraciones
app.set('port', process.env.PORT || 4000);

// Ruta correcta a la carpeta views
const viewsPath = join(__dirname, '../../frontend/src/views');
app.set('views', viewsPath);

// Configuración de Handlebars
app.engine('.hbs', engine({
    defaultLayout: 'main',
    layoutsDir: join(viewsPath, 'layouts'),
    partialsDir: join(viewsPath, 'partials'),
    extname: '.hbs',
    helpers: Handlebars
}));
app.set('view engine', '.hbs');

// Middlewares
app.use(cookieParser());
app.use(session({
    secret: 'secret', 
    saveUninitialized: false,
    resave: false,
    store: new MySQLStore(database),
    cookie: { secure: false } 
}));
app.use(flash());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Variables globales
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.message = req.flash('message');

    // 🟢 Cambiado para reflejar Cod_Empleado, Nombre y Apellido en lugar de username
    res.locals.user = req.user 
        ? { 
            Cod_Empleado: req.user.Cod_Empleado, 
            Nombre: req.user.Nombre, 
            Apellido: req.user.Apellido 
          } 
        : null;

    next();
});

// Rutas
app.use(indexRoutes);
app.use(autentificacionRoutes);
app.use('/bodega', bodegaRoutes);
app.use('/empleados', empleadosRoutes);
app.use('/productos', productosRoutes);
app.use('/proveedores', proveedoresRoutes);
app.use('/ventas', ventasRoutes);

// Ruta correcta a los archivos estáticos
const assetsPath = join(__dirname, '../../frontend/src/assets');
app.use(express.static(assetsPath));
app.set('assets', assetsPath);

// Middleware para manejar errores 404
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Página no encontrada' });
});

// Middleware para manejar errores 500
app.use((err, req, res, next) => {
    console.error('Error en la aplicación:', err);
    res.status(500).render('500', { title: 'Error en el servidor' });
});

// Inicializando Servidor
app.listen(app.get('port'), () => {
    console.log(`Servidor corriendo en el puerto ${app.get('port')}`);
});
