import cron from 'node-cron';
import { ejecutarBackupSupabase } from './backupDiario.js';
import { verifyBackups } from './verifyBackups.js';

// Configuración del programador para Supabase
cron.schedule('30 2 * * *', async () => {
    console.log('\n=== INICIANDO BACKUP AUTOMÁTICO DE SUPABASE ===');
    console.log('Hora:', new Date().toLocaleString());
    
    try {
        // 1. Ejecutar backup de Supabase
        await ejecutarBackupSupabase();
        
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
    } catch (error) {
        console.error('❌ Error en el backup automático:', error);
    }
});

console.log('🔄 Programador de backups de Supabase iniciado. Se ejecutará diariamente a las 2:30 AM');