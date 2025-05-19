import cron from 'node-cron';
import { exec } from 'child_process';
import { verifyBackups } from './verifyBackups.js';

// Configuración del programador
cron.schedule('30 2 * * *', () => {
    console.log('\n=== INICIANDO BACKUP AUTOMÁTICO ===');
    console.log('Hora:', new Date().toLocaleString());
    
    // 1. Ejecutar backup
    exec('node src/services/backup/backupDiario.js', (error, stdout, stderr) => {
        if (error) {
            console.error('Error ejecutando backup:', error);
            return;
        }
        
        console.log(stdout);
        if (stderr) console.error(stderr);
        
        // 2. Verificar backups después de ejecutar
        console.log('\n=== VERIFICANDO BACKUPS ===');
        try {
            const success = verifyBackups();
            if (!success) {
                console.error('⚠️ Advertencia: Problemas detectados en los backups');
            }
        } catch (err) {
            console.error('Error verificando backups:', err);
        }
        
        console.log('\n=== PROCESO COMPLETADO ===\n');
    });
});

console.log('🔄 Programador de backups iniciado. Se ejecutará diariamente a las 2:30 AM');