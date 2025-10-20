import express from "express";
import morgan from "morgan";
import { engine } from "express-handlebars";
import { join, dirname } from "path";
import session from "express-session";
import passport from "passport";
import { fileURLToPath } from "url";
import { pool } from "./keys.js"; 
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Handlebars } from "./lib/handlebars.js";
import './lib/passport.js';
import bodyParser from 'body-parser';
import flash from 'express-flash';
import fs from 'fs';
import pgSession from 'connect-pg-simple'; 
import path from 'path';


// ✅ CORRECCIÓN: Cambiar onst por const
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Configurar store de sesión para PostgreSQL
const PostgresqlStore = pgSession(session);

// Importación de rutas
import indexRoutes from "./routes/index.js";
import autentificacionRoutes from "./routes/autentificacion.js";
import { router as bodegaRoutes } from "./routes/bodega.js";
import { router as empleadosRoutes } from "./routes/empleados.js";
import { router as productosRoutes } from "./routes/productos.js";
import { router as proveedoresRoutes } from "./routes/proveedores.js";
import { router as ventasRoutes } from "./routes/ventas.js";
import { router as reporteempleRoutes } from "./routes/reporteemple.js";
import { router as reportesRoutes } from "./routes/reportes.js";
import dashboardRoutes from "./routes/dashboard.js";
import dashboardempleRoutes from "./routes/dashboardemple.js";
import { router as outletRoutes } from "./routes/outlet.js";

// Inicialización
const app = express();

// Configuración básica
app.set('port', process.env.PORT || 4000);
const viewsPath = join(__dirname, '../../frontend/src/views');
app.set('views', viewsPath);

// Configuración de Handlebars
const hbs = engine({
    defaultLayout: 'main',
    layoutsDir: join(viewsPath, 'layouts'),
    partialsDir: join(viewsPath, 'partials'),
    extname: '.hbs',
    helpers: {
        ...Handlebars,
        notEmpty: function(obj) {
            return obj && Object.keys(obj).length > 0;
        },
        keys: function(obj) {
            return obj ? Object.keys(obj) : [];
        },
        length: function(array) {
            return array ? array.length : 0;
        },
        gt: function(a, b) {
            return a > b;
        },
        hasProducts: function(productosPorSector, options) {
            return productosPorSector && Object.keys(productosPorSector).length > 0 ? 
                   options.fn(this) : options.inverse(this);
        }
    }
});

app.engine('.hbs', hbs);
app.set('view engine', '.hbs');

// Middlewares esenciales
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'http://localhost:4000',
        'http://192.168.1.21:4000',
        'http://192.168.1.21:5173'
    ],
    credentials: true
}));

app.use(cookieParser());

// ✅ Asegúrate de que la tabla de sesiones existe
app.use(session({
    secret: 'secret',
    store: new PostgresqlStore({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true // Esto crea la tabla automáticamente
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Cambia a true en producción con HTTPS
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(flash());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use((req, res, next) => {
    res.locals.success = req.flash('success')[0];
    res.locals.error = req.flash('error')[0];
    next();
});

// Variables globales (sin cambios)
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.message = req.flash('message');
    res.locals.user = req.user ? {
        Cod_Empleado: req.user.cod_empleado,
        Nombre: req.user.nombre,
        Apellido: req.user.apellido
    } : null;
    next();
});

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.esAdmin = req.user ? [1, 2].includes(req.user.cod_empleado) : false;
    next();
});

app.use((req, res, next) => {
    if (req.session.alertData) {
        res.locals.alertData = req.session.alertData;
        delete req.session.alertData;
    }
    next();
});

// Configuración de rutas (sin cambios)
app.use(indexRoutes);
app.use(autentificacionRoutes);
app.use('/bodega', bodegaRoutes);
app.use('/empleados', empleadosRoutes);
app.use('/productos', productosRoutes);
app.use('/proveedores', proveedoresRoutes);
app.use('/ventas', ventasRoutes);
app.use('/reportes', reportesRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/reporteemple', reporteempleRoutes);
app.use('/dashboardemple', dashboardempleRoutes);
app.use('/outlet', outletRoutes);


// Archivos estáticos (sin cambios)
const assetsPath = join(__dirname, '../../frontend/src/assets');
app.use(express.static(assetsPath));
app.set('assets', assetsPath);

// Ruta manuales (sin cambios)
app.get('/obtener-manual', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('No autenticado');
  }

  const manualesPath = join(__dirname, 'manuales');
  let archivo;

  if ([1, 2].includes(req.user.cod_empleado)) {
    archivo = 'Manual_De_Usuario_Admi.pdf';
    console.log('Descargando manual de administrador para:', req.user.cod_empleado);
  } else {
    archivo = 'Manual_de_Usuario_Worked.pdf';
    console.log('Descargando manual de empleado para:', req.user.cod_empleado);
  }

  const rutaCompleta = join(manualesPath, archivo);
  
  if (!fs.existsSync(rutaCompleta)) {
    console.error('Archivo no encontrado:', rutaCompleta);
    return res.status(404).send('Manual no encontrado');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
  res.setHeader('Content-Type', 'application/pdf');
  
  const fileStream = fs.createReadStream(rutaCompleta);
  fileStream.pipe(res);
  
  fileStream.on('error', (err) => {
    console.error('Error al enviar el archivo:', err);
    if (!res.headersSent) {
      res.status(500).send('Error al descargar el manual');
    }
  });
});

// Ruta para datos del empleado (sin cambios)
app.get('/empleados', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            success: true,
            empleado: req.user
        });
    } else {
        res.json({
            success: false,
            message: 'Empleado no autenticado'
        });
    }
});

// Manejo de errores (sin cambios)
app.use((req, res) => {
    res.status(404).render('404', { title: 'Página no encontrada' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('500', { title: 'Error en el servidor' });
});

// Iniciar servidor
// Cambia la configuración del servidor para escuchar en todas las interfaces
app.listen(app.get('port'), '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${app.get('port')}`);
    console.log(`Accesible desde otros dispositivos en: http://[TU-IP-LOCAL]:${app.get('port')}`);
});