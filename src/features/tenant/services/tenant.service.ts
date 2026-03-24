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

// ================================================================
// Story 1.6: Member role & membership management
// ================================================================

export const removeMember = async (userId: string, tenantId: string): Promise<void> => {
  // Gọi Edge Function remove-member — thực hiện: set inactive + signOut + notify + audit log
  const { error } = await supabase.functions.invoke('remove-member', {
    body: { userId, tenantId },
  })
  if (error) {
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Không thể xóa thành viên. Vui lòng thử lại.')
  }
}

export const promoteToManager = async (userId: string, tenantId: string): Promise<void> => {
  // Route qua Edge Function để có audit log với service role (P4: AC#2)
  const { error } = await supabase.functions.invoke('promote-member', {
    body: { userId, tenantId },
  })
  if (error) {
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Không thể nâng quyền thành viên. Vui lòng thử lại.')
  }
}

export const transferOwnership = async (
  newOwnerId: string,
  tenantId: string,
  currentOwnerId: string  // kept for API compatibility, server uses JWT
): Promise<void> => {
  // Route qua Edge Function — server validates caller via JWT, guards P9/P10, inserts audit logs × 2 (P4: AC#3)
  void currentOwnerId  // server identifies caller via JWT; param kept for call-site clarity
  const { error } = await supabase.functions.invoke('transfer-ownership', {
    body: { newOwnerId, tenantId },
  })
  if (error) {
    let serverMessage: string | undefined
    try {
      const body = await (error as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Không thể chuyển quyền Owner. Vui lòng thử lại.')
  }
}

export type TenantInvite = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'expired' | 'declined' | 'revoked'
  created_at: string
  expires_at: string
  invited_by: string | null
}

export const getInvites = async (tenantId: string): Promise<TenantInvite[]> => {
  const { data, error } = await supabase
    .from('tenant_invites')
    .select('id, email, status, created_at, expires_at, invited_by')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TenantInvite[]
}

export const resendInvite = async (
  inviteId: string,
  tenantId: string,
  email: string
): Promise<void> => {
  // Fetch original status for rollback if step 2 fails (P3)
  // Also validates that invite is in resendable state before revoking (P11)
  const { data: originalInvite, error: fetchError } = await supabase
    .from('tenant_invites')
    .select('status')
    .eq('id', inviteId)
    .eq('tenant_id', tenantId)
    .single()
  if (fetchError) throw fetchError
  if (!originalInvite || !['pending', 'expired'].includes(originalInvite.status)) {
    throw new Error('Lời mời không ở trạng thái có thể gửi lại.')
  }
  const originalStatus = originalInvite.status as 'pending' | 'expired'

  // Step 1: Revoke old invite
  const { error: revokeError } = await supabase
    .from('tenant_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('tenant_id', tenantId)
  if (revokeError) throw revokeError

  // Step 2: Create new invite via Edge Function (generates token + sends email)
  const { error: inviteError } = await supabase.functions.invoke('send-invite', {
    body: { tenantId, email },
  })
  if (inviteError) {
    // P3: Rollback — restore original invite status so user can retry
    await supabase
      .from('tenant_invites')
      .update({ status: originalStatus })
      .eq('id', inviteId)
      .eq('tenant_id', tenantId)
    let serverMessage: string | undefined
    try {
      const body = await (inviteError as unknown as { context: Response }).context.json()
      serverMessage = body?.error
    } catch {
      /* ignore */
    }
    throw new Error(serverMessage ?? 'Không thể gửi lại lời mời.')
  }
}

export const isSoleOwner = async (userId: string): Promise<boolean> => {
  // Lấy tất cả tenants user đang là owner
  const { data: ownerships, error } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
  if (error) throw error
  if (!ownerships || ownerships.length === 0) return false

  // Với mỗi tenant user là owner, check có owner khác không
  for (const { tenant_id } of ownerships) {
    const { count, error: countError } = await supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('role', 'owner')
      .eq('status', 'active')
    if (countError) throw countError
    // P2: count===null = RLS filtered result (cross-tenant scope issue) → treat as sole owner
    // to conservatively block deletion rather than silently permitting it
    if (count === null || count <= 1) return true  // sole owner!
  }
  return false
}
