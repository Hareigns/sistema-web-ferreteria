import { pool } from './keys.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import pgDump from 'pg-dump';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../../backups');

export async function ejecutarBackupSupabase() {
    const now = new Date();
    const fechaActual = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const BACKUP_FILE = path.join(BACKUP_DIR, `backup_supabase_${fechaActual}.sql`);

    // Crear directorio si no existe
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    try {
        // Obtener configuración de la base de datos desde el pool
        const config = {
            host: process.env.DB_HOST || 'db.xxx.supabase.co',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD
        };

        console.log('🔄 Iniciando backup de Supabase...');

        // Usar pg_dump para crear el backup
        const command = `pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -F c -b -v -f "${BACKUP_FILE}"`;

        // Configurar variable de entorno para la contraseña
        const env = { ...process.env, PGPASSWORD: config.password };

        return new Promise((resolve, reject) => {
            exec(command, { env }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Error en backup: ${error.message}`);
                    return reject(error);
                }
                
                if (stderr) {
                    console.warn(`⚠️ Advertencias: ${stderr}`);
                }

                console.log(`✅ Backup de Supabase completado: ${BACKUP_FILE}`);
                
                // Comprimir el archivo
                exec(`powershell.exe -Command "Compress-Archive -Path '${BACKUP_FILE}' -DestinationPath '${BACKUP_FILE}.zip' -Force"`, (err) => {
                    if (err) {
                        console.error('❌ Error al comprimir:', err);
                        return reject(err);
                    }
                    
                    console.log(`✅ Backup comprimido: ${BACKUP_FILE}.zip`);

                    // Eliminar archivo sin comprimir
                    fs.unlink(BACKUP_FILE, (unlinkErr) => {
                        if (unlinkErr) {
                            console.warn('⚠️ Error eliminando backup sin comprimir:', unlinkErr);
                        }
                        rotateBackups();
                        resolve();
                    });
                });
            });
        });

    } catch (error) {
        console.error('❌ Error en el proceso de backup:', error);
        throw error;
    }
}

// Función para rotar backups (mantener solo los últimos 7)
function rotateBackups() {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            console.error('❌ Error leyendo directorio:', err);
            return;
        }

        const backupFiles = files
            .filter(file => file.match(/backup_supabase_.*\.sql\.zip$/))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => a.time - b.time);

        // Mantener solo los últimos 7 backups
        if (backupFiles.length > 7) {
            console.log('\n🔄 Rotando backups de Supabase...');
            const toDelete = backupFiles.slice(0, backupFiles.length - 7);
            toDelete.forEach(file => {
                fs.unlink(path.join(BACKUP_DIR, file.name), err => {
                    if (err) {
                        console.error(`❌ Error eliminando ${file.name}:`, err);
                    } else {
                        console.log(`🗑️ Eliminado backup antiguo: ${file.name}`);
                    }
                });
            });
        }
    });
}