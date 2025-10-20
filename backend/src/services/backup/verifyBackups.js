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
            .filter(f => f.startsWith('backup_supabase_') && f.endsWith('.sql.zip'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                size: fs.statSync(path.join(BACKUP_DIR, f)).size,
                date: f.match(/backup_supabase_(.*)\.sql\.zip/)[1]
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (files.length === 0) {
            console.warn('⚠️ No hay backups disponibles de Supabase');
            return false;
        }

        const latest = files[0];

        if (latest.size < 10240) { // Mínimo 10KB para un backup válido
            console.warn(`⚠️ El último backup "${latest.name}" parece estar corrupto o vacío`);
            return false;
        }

        console.log(`✅ Último backup verificado correctamente: ${latest.name} (${(latest.size / 1024).toFixed(2)} KB)`);
        
        // Verificar que no sea más viejo de 2 días
        const backupDate = new Date(latest.date);
        const today = new Date();
        const diffDays = Math.floor((today - backupDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 2) {
            console.warn(`⚠️ El backup más reciente tiene ${diffDays} días de antigüedad`);
            return false;
        }

        return true;

    } catch (error) {
        console.error('❌ Error al verificar backups:', error.message);
        return false;
    }
}