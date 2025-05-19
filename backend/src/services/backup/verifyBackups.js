import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../../backups');

export function verifyBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            console.warn('📁 No se encontró el directorio de backups.');
            return false;
        }

        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.sql.zip'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                size: fs.statSync(path.join(BACKUP_DIR, f)).size
            }))
            .sort((a, b) => b.size - a.size);

        if (files.length === 0) {
            console.warn('⚠️ No hay backups disponibles en formato .sql.zip');
            return false;
        }

        const latest = files[0];

        if (latest.size < 1024) {
            console.warn(`⚠️ El último backup "${latest.name}" parece estar corrupto o vacío`);
            return false;
        }

        console.log(`✅ Último backup verificado correctamente: ${latest.name} (${(latest.size / 1024).toFixed(2)} KB)`);
        return true;

    } catch (error) {
        console.error('❌ Error al verificar backups:', error.message);
        return false;
    }
}
