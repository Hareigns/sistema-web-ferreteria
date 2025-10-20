// keys.js - Configuración corregida
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;

const connectionString = process.env.DB_URL;
console.log("DATABASE_URL:", connectionString);

// Configuración específica para Supabase
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Esto es necesario para Supabase
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  max: 10 // Limita el número máximo de conexiones
});

// Manejo de errores global para el pool
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de conexiones:', err);
});

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query("SELECT NOW() as current_time");
    console.log("✅ Conexión establecida correctamente con Supabase");
    console.log("⏰ Hora del servidor:", result.rows[0].current_time);
    client.release();
  } catch (err) {
    console.error("❌ Error al conectar a Supabase:", err.message);
    
    if (err.code === 'ETIMEDOUT') {
      console.log("⏱️  Timeout de conexión - verifica tu internet");
    } else if (err.code === 'ECONNREFUSED') {
      console.log("🚫 Conexión rechazada - verifica la URL");
    } else if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.log("🔒 Problema de certificado SSL");
      console.log("Intenta con: { ssl: { rejectUnauthorized: false } }");
    }
    
    if (client) client.release();
  }
}

testConnection();

export { pool };