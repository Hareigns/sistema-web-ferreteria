// database.js - MANEJO MEJORADO PARA SUPABASE
import { pool } from './keys.js';

// Función para verificar la conexión con config optimizada
const verifyConnection = async (retries = 3, delay = 2000) => {
  let client;
  
  for (let i = 0; i < retries; i++) {
    try {
      client = await pool.connect();
      
      // Query simple y rápida para verificar conexión
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      
      console.log('='.repeat(50));
      console.log('✅ CONEXIÓN SUPABASE ESTABLECIDA');
      console.log('⏰ Hora servidor:', result.rows[0].current_time);
      console.log('🗄️  PostgreSQL:', result.rows[0].pg_version.split(',')[0]);
      console.log('='.repeat(50));
      
      client.release();
      return true;
      
    } catch (err) {
      console.error(`❌ Intento ${i + 1} de ${retries}: Error de conexión:`, err.message);
      
      if (client) {
        client.release(true);
      }
      
      if (i < retries - 1) {
        console.log(`⏳ Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ No se pudo establecer conexión después de varios intentos');
        return false;
      }
    }
  }
};

// Health check periódico para mantener conexiones activas
const startHealthCheck = () => {
  setInterval(async () => {
    let client;
    try {
      client = await pool.connect();
      await client.query('SELECT 1 as health_check');
      client.release();
      console.log('🩺 Health check: OK');
    } catch (error) {
      console.log('🩺 Health check: FALLIDO -', error.message);
      if (client) client.release(true);
    }
  }, 25000); // Cada 25 segundos (menos de 30s de Supabase)
};

// Inicializar
verifyConnection().then(success => {
  if (success) {
    startHealthCheck();
  }
});

export default pool;