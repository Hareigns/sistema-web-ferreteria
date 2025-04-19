import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { database } from "./keys.js";

// Cargar variables de entorno desde .env
dotenv.config();

// Crear el pool de conexiones
const pool = mysql.createPool(database);

// Verificar la conexión
const verifyConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦➦  La base de datos está conectada\n➤\n➤');
    connection.release();
  } catch (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Se perdió la conexión a la base de datos');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('La base de datos tiene demasiadas conexiones');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Se ha rechazado la conexión a la base de datos');
    } else {
      console.error('Error de conexión a la base de datos:', err);
    }
  }
};

verifyConnection();

export default pool;
