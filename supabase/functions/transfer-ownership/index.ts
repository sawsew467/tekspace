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

  // Verify caller via JWT
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { newOwnerId?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { newOwnerId, tenantId } = body
  if (!newOwnerId || !tenantId) {
    return new Response(JSON.stringify({ error: 'newOwnerId và tenantId là bắt buộc.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Guard: không chuyển ownership cho chính mình (P9)
  if (newOwnerId === caller.id) {
    return new Response(JSON.stringify({ error: 'Không thể chuyển quyền Owner cho chính mình.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller là owner của tenant (chỉ owner mới transfer được — AC#3)
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
  if (!callerMembership || callerMembership.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Chỉ Owner mới có thể chuyển quyền Owner.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify target tồn tại và là active member
  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', newOwnerId)
    .eq('status', 'active')
    .single()

  if (targetError || !targetMembership) {
    return new Response(JSON.stringify({ error: 'Không tìm thấy thành viên.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Step 1: Demote current owner → manager (P10: verify row affected)
  const { data: demoted, error: demoteError } = await supabaseAdmin
    .from('tenant_members')
    .update({ role: 'manager' })
    .eq('user_id', caller.id)
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')  // Extra guard: ensure the row is still owner
    .select('id')
    .single()

  if (demoteError || !demoted) {
    return new Response(JSON.stringify({ error: 'Không thể thực hiện chuyển quyền. Vui lòng thử lại.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Step 2: Promote new owner
  // NOTE: 2 updates không atomic — nếu step 2 fail → demote đã xảy ra.
  // MVP acceptable risk. Post-MVP: dùng DB function hoặc RPC.
  const { error: promoteError } = await supabaseAdmin
    .from('tenant_members')
    .update({ role: 'owner' })
    .eq('user_id', newOwnerId)
    .eq('tenant_id', tenantId)

  if (promoteError) {
    // Attempt rollback: restore caller as owner
    await supabaseAdmin
      .from('tenant_members')
      .update({ role: 'owner' })
      .eq('user_id', caller.id)
      .eq('tenant_id', tenantId)
    return new Response(JSON.stringify({ error: 'Không thể chuyển quyền. Đã rollback.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // INSERT audit logs × 2 (AC#3)
  const previousRole = targetMembership.role
  await supabaseAdmin.from('member_audit_logs').insert([
    {
      tenant_id: tenantId,
      actor_id: caller.id,
      target_id: caller.id,
      action: 'transfer_ownership_from',
      details: { previousRole: 'owner', newRole: 'manager' },
    },
    {
      tenant_id: tenantId,
      actor_id: caller.id,
      target_id: newOwnerId,
      action: 'transfer_ownership_to',
      details: { previousRole, newRole: 'owner' },
    },
  ])

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
