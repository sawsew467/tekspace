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

export const requestPasswordReset = async (email: string) => {
  // Fallback về origin hiện tại nếu VITE_APP_URL không được set
  const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}${ROUTES.resetPassword}`,
  })
  if (error) throw error
}

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/**
 * Xác minh mật khẩu hiện tại bằng cách re-authenticate, sau đó cập nhật mật khẩu mới.
 *
 * ⚠️ Side effect: signInWithPassword tạo session mới (rotate refresh token).
 * Điều này là bình thường — user vẫn là chính họ, không có navigation side effect.
 * Nếu updateUser fail sau khi signIn thành công, session đã được refresh nhưng
 * password chưa đổi — caller sẽ nhận updateError và nên thông báo user thử lại.
 *
 * @throws {{ code: 'INVALID_CURRENT_PASSWORD' }} khi currentPassword sai
 * @throws {AuthError} khi updateUser thất bại (network, policy, v.v.)
 */
export const verifyAndChangePassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
) => {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (signInError) {
    throw Object.assign(new Error('invalid_current_password'), {
      code: 'INVALID_CURRENT_PASSWORD',
    })
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError
}
