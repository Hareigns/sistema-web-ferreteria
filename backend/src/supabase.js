import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

// Verificación más detallada
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de Supabase:')
  console.error('SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌ Faltante')
  throw new Error('Configuración de Supabase incompleta')
}

// Verificar formato de la URL
if (!supabaseUrl.startsWith('https://')) {
  throw new Error('SUPABASE_URL debe comenzar con https://')
}

// Verificar formato de la clave (debe comenzar con eyJ)
if (!supabaseKey.startsWith('eyJ')) {
  throw new Error('SUPABASE_ANON_KEY tiene formato inválido')
}

console.log('✅ Supabase configurado correctamente')
console.log('URL:', supabaseUrl)
console.log('Clave:', supabaseKey.substring(0, 20) + '...')

export const supabase = createClient(supabaseUrl, supabaseKey)