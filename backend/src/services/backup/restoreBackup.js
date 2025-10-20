import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../../backups');

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log('No existe el directorio de backups');
        return [];
    }

    return fs.readdirSync(BACKUP_DIR)
        .filter(file => file.match(/backup_supabase_.*\.sql\.zip$/))
        .sort()
        .reverse();
}

function restoreBackup(backupFile) {
    const backupPath = path.join(BACKUP_DIR, backupFile);
    const tempDir = path.join(BACKUP_DIR, `temp_restore_${Date.now()}`);
    const extractedFile = path.join(tempDir, backupFile.replace('.zip', ''));

    try {
        if (!fs.existsSync(backupPath)) {
            throw new Error('Archivo de backup no encontrado');
        }

        console.log(`\n🔍 Procesando ${backupFile}...`);
        
        // Crear directorio temporal
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Descomprimir
        exec(`powershell -Command "Expand-Archive -Path '${backupPath}' -DestinationPath '${tempDir}' -Force"`);

        // Configuración de Supabase
        const config = {
            host: process.env.DB_HOST || 'db.xxx.supabase.co',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD
        };

        // Verificar que el archivo existe
        if (!fs.existsSync(extractedFile)) {
            throw new Error('Archivo extraído no encontrado');
        }

        console.log('🔄 Restaurando base de datos Supabase...');
        
        // Comando para restaurar
        const command = `pg_restore -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -v "${extractedFile}"`;
        const env = { ...process.env, PGPASSWORD: config.password };

        execSync(command, { env, stdio: 'inherit' });
        
        console.log('✅ Restauración completada con éxito');
        return true;

    } catch (error) {
        console.error('❌ Error durante la restauración:', error.message);
        return false;
    } finally {
        // Limpiar archivos temporales
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

function main() {
    const backups = listBackups();

    if (backups.length === 0) {
        console.log('No hay backups disponibles de Supabase');
        return;
    }

    // Restaurar el backup más reciente
    const latestBackup = backups[0];
    console.log(`🔄 Restaurando backup: ${latestBackup}`);
    
    const success = restoreBackup(latestBackup);
    
    if (success) {
        console.log('✅ Proceso de restauración completado exitosamente');
    } else {
        console.log('❌ Hubo un error durante la restauración');
    }
}

// Ejecutar solo si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { restoreBackup, listBackups };