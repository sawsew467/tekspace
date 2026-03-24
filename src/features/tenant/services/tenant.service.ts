import { supabase } from '@/lib/supabase-browser'
import type { TeamSettingsInput } from '@/features/tenant/schemas/tenant.schema'

// P-12: return type rõ ràng để type safety
export type TenantSettings = {
  id: string
  name: string
  timezone: string
  schedule_deadline_day: number
  schedule_deadline_hour: number
  daily_report_deadline_hour: number
  default_committed_hours: number
}

export type TenantMemberWithUser = {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'member'
  status: 'active' | 'inactive'
  committed_hours: number | null
  users: {
    id: string
    full_name: string
    avatar_url: string | null
    timezone: string
    email: string | null
  }
}

export type InviteTokenInfo = {
  tenantId: string
  tenantName: string
  email: string
  status: string
  expiresAt: string
}

export const createTenant = async (name: string) => {
  // 1. Insert tenant WITHOUT .select() để tránh INSERT+RETURNING RLS issue:
  //    Khi chain .select() trên INSERT, PostgREST dùng "INSERT ... RETURNING"
  //    và apply SELECT policy trên returned rows. SELECT policy check tenant_members,
  //    nhưng trigger handle_new_tenant chưa visible trong cùng RETURNING evaluation
  //    → 403 RLS violation. Dùng return=minimal (no RETURNING) thay thế.
  //    Trigger handle_new_tenant vẫn tạo owner membership, nhưng tenant ID
  //    sẽ được lấy từ JWT sau refreshSession (custom_access_token_hook embeds tenant_roles).
  const { error: insertError } = await supabase.from('tenants').insert({ name })
  if (insertError) throw insertError

  // 2. Refresh session để JWT mới có tenant_roles từ custom_access_token_hook
  // QUAN TRỌNG: Phải gọi refreshSession() để hook embed tenant_roles mới vào JWT.
  // Thiếu bước này → tenant store sẽ không có tenant → app redirect loop.
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) throw refreshError

  // P-01: session null sau refreshSession là lỗi, không phải silent skip
  if (!refreshData.session) throw new Error('Session refresh returned null — cannot initialize tenant')

  return { session: refreshData.session }
}

export const getTenantSettings = async (tenantId: string): Promise<TenantSettings> => {
  // P-13: bỏ 'name' khỏi SELECT vì không dùng trong TeamSettingsInput
  // Giữ lại để hiển thị tên team — nhưng exclude khỏi form schema
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, name, timezone, schedule_deadline_day, schedule_deadline_hour, daily_report_deadline_hour, default_committed_hours'
    )
    .eq('id', tenantId)
    .single()
  if (error) throw error
  if (!data) throw new Error('Tenant settings not found')
  return data as TenantSettings
}

export const updateTenantSettings = async (
  tenantId: string,
  settings: TeamSettingsInput
): Promise<void> => {
  // F4: Destructure rõ ràng thay vì truyền thẳng settings object vào .update()
  // Tránh mass-assignment nếu TeamSettingsInput mở rộng thêm fields trong tương lai
  const {
    timezone,
    schedule_deadline_day,
    schedule_deadline_hour,
    daily_report_deadline_hour,
    default_committed_hours,
  } = settings

  // P-02: chain .select() để detect silent RLS-blocked updates
  const { data, error } = await supabase
    .from('tenants')
    .update({
      timezone,
      schedule_deadline_day,
      schedule_deadline_hour,
      daily_report_deadline_hour,
      default_committed_hours,
    })
    .eq('id', tenantId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update returned no rows — check RLS policies')
}

export const getMembers = async (tenantId: string): Promise<TenantMemberWithUser[]> => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('id, user_id, role, status, committed_hours, users(id, full_name, avatar_url, timezone, email)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as TenantMemberWithUser[]
}

export const inviteMember = async (
  tenantId: string,
  email: string
): Promise<{ inviteLink: string }> => {
  // Gọi Edge Function send-invite — xác thực + INSERT tenant_invites + gửi email
  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { tenantId, email },
  })
  if (error) {
    // P12: Extract user-facing error message từ response body thay vì dùng SDK generic message
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore — network error hoặc non-JSON response */
    }
    throw new Error(serverMessage ?? 'Không thể gửi lời mời.')
  }
  const appUrl = window.location.origin
  return { inviteLink: `${appUrl}/accept-invite?token=${data.token}` }
}

export const validateInviteToken = async (token: string): Promise<InviteTokenInfo> => {
  // Gọi accept-invite Edge Function với validateOnly=true để không cần JWT tenant context
  // RLS trên tenant_invites check current_tenant_id() → block nếu user chưa có tenant
  // Bypass: dùng Edge Function với supabaseAdmin
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token, validateOnly: true },
  })
  if (error) {
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Lời mời không hợp lệ.')
  }
  // P10: Guard shape trước khi cast
  if (!data?.tenantId) throw new Error('Lời mời không hợp lệ.')
  return data as InviteTokenInfo
}

export const acceptInvite = async (token: string): Promise<{ tenantId: string }> => {
  // Gọi accept-invite Edge Function — bypass RLS với service role
  // P1: userId không truyền qua body — Edge Function extract từ JWT đã xác thực
  // INSERT tenant_members + UPDATE tenant_invites status='accepted'
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token },
  })
  if (error) {
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Không thể chấp nhận lời mời.')
  }
  // P10: Guard shape trước khi cast
  if (!data?.tenantId) throw new Error('Phản hồi không hợp lệ từ server.')
  return data as { tenantId: string }
}
