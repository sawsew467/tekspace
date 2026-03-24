import { supabase } from '@/lib/supabase-browser'

export const updateTimezone = async (userId: string, timezone: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ timezone })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
}

export const updateActiveTenant = async (userId: string, tenantId: string): Promise<void> => {
  // Lưu active_tenant_id vào DB để custom_access_token_hook đọc được
  const { error } = await supabase
    .from('users')
    .update({ active_tenant_id: tenantId })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
}

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, timezone, active_tenant_id')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}
