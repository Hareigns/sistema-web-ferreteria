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
import flash from 'express-flash';
import fs from 'fs';
import pgSession from 'connect-pg-simple'; 
import { createServer } from 'http';
import socketManager from './socket-manager.js';

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
import { router as catalogoRoutes } from "./routes/catalogo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PostgresqlStore = pgSession(session);

// Inicialización
const app = express();
const server = createServer(app);

// ✅ CONFIGURACIÓN CRÍTICA: LÍMITES DE TAMAÑO DE PAYLOAD
// ESTO DEBE IR AL PRINCIPIO, ANTES DE CUALQUIER OTRO MIDDLEWARE
app.use(express.json({ limit: '50mb' })); // 🔥 AUMENTAR LÍMITE A 50MB
app.use(express.urlencoded({ 
    limit: '50mb', 
    extended: true,
    parameterLimit: 100000 // 🔥 AUMENTAR LÍMITE DE PARÁMETROS
}));

console.log('✅ Límites configurados: JSON=50MB, URLEncoded=50MB');

const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:4000',
  'http://192.168.1.21:4000',
  'http://192.168.1.21:5173',
  'http://localhost:3000',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:5173'
];

const corsOptions = {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('❌ Origen bloqueado por CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  cookie: {
    name: "io",
    path: "/",
    httpOnly: true,
    sameSite: "lax"
  }
};

// ✅ INICIALIZAR SOCKET MANAGER GLOBAL
const io = socketManager.initialize(server, corsOptions);

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
    // CONFIGURACIÓN CRÍTICA PARA BUSCAR EN SUBCARPETAS
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    },
    // AGREGAR ESTA CONFIGURACIÓN
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
        },
        eq: function(a, b) {
            return a === b;
        }
    }
});

app.engine('.hbs', hbs);
app.set('view engine', '.hbs');

// ✅ CONFIGURACIÓN SIMPLIFICADA DE CORS
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(cookieParser());

// Session configuration
app.use(session({
    secret: 'secret',
    store: new PostgresqlStore({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
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

// Variables globales
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

// ✅ Hacer io disponible en las rutas
app.set('io', io);
app.use((req, res, next) => {
  req.io = io;
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
app.use('/catalogo', catalogoRoutes);

// Archivos estáticos
const assetsPath = join(__dirname, '../../frontend/src/assets');
app.use(express.static(assetsPath));
app.set('assets', assetsPath);

// Ruta manuales
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
  console.error('❌ Error del servidor:', err);
  
  // Manejo específico para errores de tamaño de payload
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: "Archivo demasiado grande. El límite es 50MB."
    });
  }
  
  res.status(500).render('500', { title: 'Error en el servidor' });
});

// Iniciar servidor
server.listen(app.get('port'), '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 SERVIDOR INICIADO CORRECTAMENTE');
    console.log('='.repeat(60));
    console.log(`   URL: http://localhost:${app.get('port')}`);
    console.log(`   📡 WebSockets: ACTIVOS en puerto ${app.get('port')}`);
    console.log(`   📦 Límite de payload: 50MB`);
    console.log(`   🌐 Orígenes permitidos:`, allowedOrigins);
    console.log('='.repeat(60));
});