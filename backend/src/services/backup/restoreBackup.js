import { database } from '../../keys.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(process.cwd(), 'backups');

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log('No existe el directorio de backups');
        return [];
    }

    return fs.readdirSync(BACKUP_DIR)
        .filter(file => file.match(/backup_completo_.*\.sql(\.gz|\.zip)?$/))
        .sort()
        .reverse();
}

function restoreBackup(backupFile) {
    const backupPath = path.join(BACKUP_DIR, backupFile);
    const tempFile = path.join(BACKUP_DIR, `temp_restore_${Date.now()}.sql`);

    try {
        if (!fs.existsSync(backupPath)) {
            throw new Error('Archivo de backup no encontrado');
        }

        console.log(`\n🔍 Procesando ${backupFile}...`);
        
        // Manejo para .zip y .gz
        if (backupFile.endsWith('.zip')) {
    execSync(`powershell -Command "Expand-Archive -Path '${backupPath}' -DestinationPath '${BACKUP_DIR}' -Force"`);
    const uncompressedFile = backupPath.replace('.zip', '');
    fs.renameSync(uncompressedFile, tempFile);
}
 else if (backupFile.endsWith('.gz')) {
            execSync(`gzip -dc "${backupPath}" > "${tempFile}"`);
        } else {
            fs.copyFileSync(backupPath, tempFile);
        }

        const stats = fs.statSync(tempFile);
        if (stats.size < 1024) {
            throw new Error('Archivo de backup parece estar vacío o corrupto');
        }

        console.log('🔄 Restaurando base de datos...');
        const command = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql" \
            --host=${database.host} \
            --port=${database.port} \
            --user=${database.user} \
            --password=${database.password} \
            ${database.database} < "${tempFile}"`;

        execSync(command, { stdio: 'inherit' });
        console.log('✅ Restauración completada con éxito');
        return true;
    } catch (error) {
        console.error('❌ Error durante la restauración:', error.message);
        return false;
    } finally {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

function main() {
    const backups = listBackups();

    if (backups.length === 0) {
        console.log('No hay backups disponibles');
        console.log('Ejecuta primero: node src/services/backup/backupDiario.js');
        return;
    }

    // Restaurar automáticamente el backup más reciente
    const latestBackup = backups[0];
    console.log(`🔄 Restaurando automáticamente el backup más reciente: ${latestBackup}`);
    
    const success = restoreBackup(latestBackup);
    
    if (success) {
        console.log('✅ Proceso de restauración completado exitosamente');
    } else {
        console.log('❌ Hubo un error durante la restauración automática');
    }
}

main();