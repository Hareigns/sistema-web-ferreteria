import { database } from '../../keys.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../../backups');

export async function ejecutarBackup() {
    const DATE = new Date().toISOString().split('T')[0];
    const BACKUP_FILE = path.join(BACKUP_DIR, `backup_completo_${DATE}.sql`);

    // Crear directorio si no existe
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const command = `"${process.env.MYSQL_PATH || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump'}" \
--host=${database.host} \
--port=${database.port} \
--user=${database.user} \
--password=${database.password} \
--single-transaction \
--routines \
--triggers \
--events \
${database.database} > "${BACKUP_FILE}"`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error en backup: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.warn(`⚠️ Advertencias: ${stderr}`);
            }

            console.log(`✅ Backup completado: ${BACKUP_FILE}`);

            // Comprimir el archivo
            exec(`powershell.exe -Command "Compress-Archive -Path '${BACKUP_FILE}' -DestinationPath '${BACKUP_FILE}.zip' -Force"`, (err) => {
                if (err) {
                    console.error('❌ Error al comprimir:', err);
                    return reject(err);
                }
                console.log(`✅ Backup comprimido: ${BACKUP_FILE}.zip`);

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
}

function rotateBackups() {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            console.error('❌ Error leyendo directorio:', err);
            return;
        }

        const backupFiles = files
            .filter(file => file.match(/backup_completo_.*\.sql\.zip$/))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => a.time - b.time);

        // Mantener solo los últimos 7 backups
        if (backupFiles.length > 7) {
            console.log('\n🔄 Rotando backups...');
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
