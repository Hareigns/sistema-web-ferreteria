import express from "express";
import morgan from "morgan";
import { engine } from "express-handlebars";
import { join, dirname } from "path";
import session from "express-session";
//import flash from "connect-flash";
import MySQLStoreFactory from "express-mysql-session";
import passport from "passport";
import { fileURLToPath } from "url";
import { database } from "./keys.js";
import cookieParser from 'cookie-parser';
import cors from 'cors'; // Importación añadida
import { Handlebars } from "./lib/handlebars.js";
import './lib/passport.js';
import bodyParser from 'body-parser';
import flash from 'express-flash';
import fs from 'fs';

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
const __dirname = dirname(fileURLToPath(import.meta.url));
const MySQLStore = MySQLStoreFactory(session);

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
        ...Handlebars, // Tus helpers existentes
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
        // Helper alternativo más simple
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
    origin: 'http://localhost:5173', // Ajusta según tu puerto frontend
    credentials: true
}));

app.use(cookieParser());
app.use(session({
    secret: 'secret',
    store: new MySQLStore(database),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
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
    res.locals.success = req.flash('success')[0]; // Tomamos el primer mensaje
    res.locals.error = req.flash('error')[0];
    next();
});


// Variables globales
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.message = req.flash('message');
    res.locals.user = req.user ? {
        Cod_Empleado: req.user.Cod_Empleado,
        Nombre: req.user.Nombre,
        Apellido: req.user.Apellido
    } : null;
    next();
});

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.esAdmin = req.user ? [1, 2].includes(req.user.Cod_Empleado) : false;
    next();
  });


  // Añade esto con tus otros middlewares
app.use((req, res, next) => {
    // Pasar alertData a las vistas
    if (req.session.alertData) {
        res.locals.alertData = req.session.alertData;
        delete req.session.alertData; // Limpiar después de usar
    }
    next();
});

// Configuración de rutas
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

// Archivos estáticos
const assetsPath = join(__dirname, '../../frontend/src/assets');
app.use(express.static(assetsPath));
app.set('assets', assetsPath);


// Agrega esta ruta nueva (reemplaza la anterior /descargar-manual/:tipo)
app.get('/obtener-manual', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('No autenticado');
  }

  const manualesPath = join(__dirname, 'manuales');
  let archivo;

  // Verifica el código del empleado desde la sesión
  if ([1, 2].includes(req.user.Cod_Empleado)) {
    archivo = 'Manual_De_Usuario_Admi.pdf';
    console.log('Descargando manual de administrador para:', req.user.Cod_Empleado);
  } else {
    archivo = 'Manual_de_Usuario_Worked.pdf';
    console.log('Descargando manual de empleado para:', req.user.Cod_Empleado);
  }

  const rutaCompleta = join(manualesPath, archivo);
  
  if (!fs.existsSync(rutaCompleta)) {
    console.error('Archivo no encontrado:', rutaCompleta);
    return res.status(404).send('Manual no encontrado');
  }

  // Configura headers para forzar descarga
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
  res.setHeader('Content-Type', 'application/pdf');
  
  // Stream el archivo
  const fileStream = fs.createReadStream(rutaCompleta);
  fileStream.pipe(res);
  
  fileStream.on('error', (err) => {
    console.error('Error al enviar el archivo:', err);
    if (!res.headersSent) {
      res.status(500).send('Error al descargar el manual');
    }
  });
});


// Ruta para datos del empleado
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

// Manejo de errores
app.use((req, res) => {
    res.status(404).render('404', { title: 'Página no encontrada' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('500', { title: 'Error en el servidor' });
});

// Iniciar servidor
app.listen(app.get('port'), () => {
    console.log(`Servidor corriendo en http://localhost:${app.get('port')}`);

    // Ejecutar backup al iniciar el servidor
    import('./services/backup/backupDiario.js')
        .then(mod => mod.ejecutarBackup())
        .then(() => console.log('🛡️ Backup ejecutado al iniciar el servidor'))
        .catch(err => console.error('❌ Error ejecutando backup al iniciar:', err));
});

