import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(
  env.supabaseUrl ?? 'https://example.supabase.co',
  env.supabaseAnonKey ?? 'public-anon-key',
)
