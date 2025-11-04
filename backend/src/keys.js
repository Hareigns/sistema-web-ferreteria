// keys.js - CONFIGURACIÓN OPTIMIZADA PARA SUPABASE
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;

const connectionString = process.env.DB_URL;

// ✅ CONFIGURACIÓN ESPECÍFICA PARA SUPABASE
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // CONFIGURACIÓN CRÍTICA PARA EVITAR db_termination
  max: 3, // Muy importante: Supabase tiene límites estrictos
  idleTimeoutMillis: 10000, // 10 segundos (Supabase cierra en 30s)
  connectionTimeoutMillis: 5000,
  maxUses: 500, // Reciclar frecuentemente
  
  // Timeouts específicos para Supabase
  statement_timeout: 15000,
  query_timeout: 15000,
  idle_in_transaction_session_timeout: 10000,
});

// ✅ MANEJO MEJORADO DE ERRORES
pool.on('error', (err, client) => {
  console.error('❌ Error en pool PostgreSQL:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });
});

pool.on('connect', (client) => {
  console.log('✅ Nueva conexión Supabase');
  // Configurar timeouts para esta conexión específica
  client.query('SET statement_timeout = 15000');
  client.query('SET idle_in_transaction_session_timeout = 10000');
});

pool.on('remove', (client) => {
  console.log('🔌 Conexión removida - Reciclaje normal');
});

export { pool };