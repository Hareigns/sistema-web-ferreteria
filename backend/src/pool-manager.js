// pool-manager.js - VERSIÓN MEJORADA
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

class PoolManager {
  constructor() {
    this.pool = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  init() {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DB_URL,
        ssl: { rejectUnauthorized: false },
        max: 3, // Muy conservador para Supabase
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        maxUses: 5000, // Reciclar más frecuentemente
      });

      this.setupEventHandlers();
    }
  }

  setupEventHandlers() {
    this.pool.on('error', (err, client) => {
      console.error('❌ Error crítico en pool:', err.message);
      this.retryCount++;
      
      if (this.retryCount <= this.maxRetries) {
        console.log(`🔄 Reintentando conexión (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.reconnect(), 5000);
      } else {
        console.error('🚨 Máximos reintentos alcanzados. Verificar conexión a Supabase.');
      }
    });

    this.pool.on('connect', (client) => {
      console.log('✅ Conexión DB establecida');
      this.retryCount = 0; // Resetear contador en conexión exitosa
    });

    this.pool.on('remove', (client) => {
      console.log('🔌 Conexión DB removida (normal para Supabase)');
    });
  }

  reconnect() {
    if (this.pool) {
      this.pool.end().then(() => {
        console.log('🔄 Reinicializando pool de conexiones...');
        this.pool = null;
        this.init();
      });
    }
  }

  async getConnection() {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      console.error('❌ Error al obtener conexión:', error.message);
      
      // Si es un error de conexión, intentar reconectar
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.reconnect();
      }
      
      throw error;
    }
  }

  releaseConnection(client) {
    if (client) {
      client.release();
    }
  }

  async end() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔒 Pool de conexiones cerrado');
    }
  }
}

export const poolManager = new PoolManager();