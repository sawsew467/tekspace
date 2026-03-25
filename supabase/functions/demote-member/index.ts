import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller via JWT (slice(7) thay vì replace để handle case-insensitive & first-only)
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { userId?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { userId, tenantId } = body
  if (!userId || !tenantId) {
    return new Response(JSON.stringify({ error: 'userId và tenantId là bắt buộc.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller là owner của tenant (chỉ owner mới demote được — nhất quán với promote)
  const { data: callerMembership, error: callerError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', caller.id)
    .eq('status', 'active')
    .single()

  if (callerError) {
    // PGRST116 = no rows → caller không phải member của tenant → 403, không phải 500
    const status = callerError.code === 'PGRST116' ? 403 : 500
    const message = callerError.code === 'PGRST116'
      ? 'Bạn không có quyền trong tenant này.'
      : 'Lỗi khi kiểm tra quyền. Vui lòng thử lại.'
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!callerMembership || callerMembership.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Chỉ Owner mới có thể hạ quyền Manager.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify target là manager đang active (không demote member)
  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (targetError || !targetMembership) {
    return new Response(JSON.stringify({ error: 'Không tìm thấy thành viên.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (targetMembership.role !== 'manager') {
    return new Response(JSON.stringify({ error: 'Chỉ có thể hạ quyền Manager xuống Member.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // UPDATE role → member (P6: dùng .select('id') để verify row affected)
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('tenant_members')
    .update({ role: 'member' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select('id')
    .single()

  if (updateError || !updated) {
    return new Response(JSON.stringify({ error: 'Không thể hạ quyền thành viên. Vui lòng thử lại.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // INSERT audit log — check result để không silent-fail trên security-sensitive operation
  const { error: auditError } = await supabaseAdmin.from('member_audit_logs').insert({
    tenant_id: tenantId,
    actor_id: caller.id,
    target_id: userId,
    action: 'demote_manager',
    details: { previousRole: 'manager', newRole: 'member' },
  })
  if (auditError) {
    // Log nhưng không fail request — role đã đổi thành công, audit failure là secondary concern
    console.error('[demote-member] Audit log INSERT failed:', auditError.message)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
