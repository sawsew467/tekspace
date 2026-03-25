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

  // Không cho phép xóa chính mình
  if (userId === caller.id) {
    return new Response(JSON.stringify({ error: 'Không thể xóa chính bạn khỏi team.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller là owner/manager của tenant (P12: destructure error để phân biệt DB fail vs 403)
  const { data: callerMembership, error: callerError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', caller.id)
    .eq('status', 'active')
    .single()

  if (callerError) {
    return new Response(JSON.stringify({ error: 'Lỗi khi kiểm tra quyền. Vui lòng thử lại.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!callerMembership || !['owner', 'manager'].includes(callerMembership.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify target thuộc tenant và lấy role để check hierarchy (P1, P6)
  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (targetError || !targetMembership) {
    return new Response(JSON.stringify({ error: 'Không tìm thấy thành viên trong team.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // P1: Manager không thể xóa manager hoặc owner — chỉ owner mới xóa được manager
  if (callerMembership.role === 'manager' && targetMembership.role !== 'member') {
    return new Response(JSON.stringify({ error: 'Manager chỉ có thể xóa member, không thể xóa manager hoặc owner.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get tenant name for notification
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // 1. UPDATE tenant_members → inactive (P6: dùng .select('id') để verify row affected)
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('tenant_members')
    .update({ status: 'inactive' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()

  if (updateError || !updated) {
    return new Response(JSON.stringify({ error: 'Không thể xóa thành viên. Vui lòng thử lại.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Invalidate session ngay lập tức bằng GoTrue admin REST API
  // Lý do: supabaseAdmin.auth.admin.signOut(jwt) nhận JWT string, không phải userId UUID
  // → dùng REST endpoint /auth/v1/admin/users/{id}/logout để revoke tất cả sessions theo user_id
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[remove-member] SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình — bỏ qua logout')
  } else {
    try {
      const logoutRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/logout`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      })
      if (!logoutRes.ok) {
        // Log warning — session có thể chưa bị revoke, nhưng status=inactive là guard chính
        console.warn(`[remove-member] GoTrue logout returned ${logoutRes.status} cho user ${userId}`)
      }
    } catch (err) {
      // Network error — log để debug, nhưng không fail request
      console.warn('[remove-member] Network error khi logout user session:', err)
    }
  }

  // 3. INSERT in-app notification cho user bị xóa
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: userId,
    type: 'member_removed',
    message: `Bạn đã bị xóa khỏi${tenant?.name ? ` team ${tenant.name}` : ' team'}. Cảm ơn đã tham gia cùng team!`,
    link_to: null,
  })

  // 4. INSERT audit log (service role bypass — không cần RLS INSERT policy)
  await supabaseAdmin.from('member_audit_logs').insert({
    tenant_id: tenantId,
    actor_id: caller.id,
    target_id: userId,
    action: 'remove',
    details: { tenantName: tenant?.name ?? null },
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
