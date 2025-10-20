// database.js - Para PostgreSQL
import { pool } from './keys.js';

// Función para verificar la conexión
const verifyConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦');
    console.log('✅ La base de datos PostgreSQL está conectada');
    console.log('➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦');
    client.release();
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Se ha rechazado la conexión a la base de datos');
    } else if (err.code === '3D000') {
      console.error('❌ La base de datos no existe');
    } else if (err.code === '28P01') {
      console.error('❌ Error de autenticación - verifica usuario y contraseña');
    } else {
      console.error('❌ Error de conexión a la base de datos:', err.message);
    }
  }
};

verifyConnection();

export default pool;