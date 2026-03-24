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

  // Verify caller là owner của tenant (chỉ owner mới promote được — AC#2)
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
    return new Response(JSON.stringify({ error: 'Chỉ Owner mới có thể nâng quyền thành viên.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify target là member đang active (không promote manager lên manager)
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
  if (targetMembership.role !== 'member') {
    return new Response(JSON.stringify({ error: 'Chỉ có thể nâng quyền Member lên Manager.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // UPDATE role → manager
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('tenant_members')
    .update({ role: 'manager' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select('id')
    .single()

  if (updateError || !updated) {
    return new Response(JSON.stringify({ error: 'Không thể nâng quyền thành viên. Vui lòng thử lại.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // INSERT audit log (service role bypass — không cần RLS INSERT policy)
  await supabaseAdmin.from('member_audit_logs').insert({
    tenant_id: tenantId,
    actor_id: caller.id,
    target_id: userId,
    action: 'promote_manager',
    details: { previousRole: 'member', newRole: 'manager' },
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
