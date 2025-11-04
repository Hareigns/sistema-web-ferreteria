// middleware/db.js - Manejo robusto de conexiones Supabase
import { pool } from '../keys.js';

export const withDatabase = (handler) => {
  return async (req, res, next) => {
    let client;
    let retries = 2;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Obtener conexión con timeout corto
        client = await Promise.race([
          pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de conexión')), 3000)
          )
        ]);
        
        req.dbClient = client;
        
        // Ejecutar el handler
        await handler(req, res, next);
        
        // Éxito, salir del loop
        return;
        
      } catch (error) {
        console.error(`❌ Intento ${attempt + 1} fallido:`, error.message);
        
        // Liberar cliente si existe
        if (client) {
          try {
            client.release(true);
          } catch (releaseError) {
            console.error('Error liberando conexión:', releaseError);
          }
          client = null;
        }
        
        // Si es el último intento o error específico de Supabase
        if (attempt === retries || 
            error.message.includes('shutdown') || 
            error.code === 'XX000' ||
            error.message.includes('termination')) {
          
          console.error('❌ Error crítico de base de datos después de reintentos');
          
          res.status(503).json({ 
            success: false, 
            message: 'Servicio de base de datos temporalmente no disponible',
            code: 'DATABASE_UNAVAILABLE',
            retryable: true
          });
          return;
        }
        
        // Esperar antes de reintentar
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  };
};