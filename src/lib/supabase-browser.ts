import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-types'

// TUYỆT ĐỐI KHÔNG createClient() lần 2 ở bất kỳ file nào khác
// Agents LUÔN import { supabase } từ đây
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
