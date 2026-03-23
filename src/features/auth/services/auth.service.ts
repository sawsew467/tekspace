import { supabase } from '@/lib/supabase-browser'
import { ROUTES } from '@/lib/routes'
import { useTenantStore } from '@/stores/tenant-store'
import type { Session } from '@supabase/supabase-js'

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export const getUserTenants = async (userId: string) => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(id, name)')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return data ?? []
}

/**
 * Khởi tạo tenant store từ JWT session và trả về route redirect phù hợp.
 * Side effect: cập nhật useTenantStore (initFromSession + setActiveTenant nếu có tenant).
 * Gọi sau khi signIn/signUp thành công, trước khi navigate.
 */
export const initTenantAndGetRoute = (session: Session): string => {
  const tenantStore = useTenantStore.getState()
  tenantStore.initFromSession(session.access_token)

  const { tenants } = useTenantStore.getState()
  if (tenants.length > 0) {
    tenantStore.setActiveTenant(tenants[0].tenantId)
    return ROUTES.app.dashboard
  }

  return ROUTES.app.createTenant
}
