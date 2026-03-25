import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth via JWT decode (getUserFromJwt — tránh JWT issuer mismatch trong local dev)
  // supabaseAdmin.auth.getUser() gọi HTTP → GoTrue reject iss mismatch → hang → timeout
  const caller = getUserFromJwt(req.headers.get('Authorization'))
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { incidentId?: string; memberId?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { incidentId, memberId, tenantId } = body
  if (!incidentId || !memberId || !tenantId) {
    return new Response(JSON.stringify({ error: 'incidentId, memberId và tenantId là bắt buộc.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller là owner/manager của tenant
  const { data: callerMembership, error: callerError } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', caller.id)
    .eq('status', 'active')
    .single()

  if (callerError) {
    return new Response(JSON.stringify({ error: 'Lỗi khi kiểm tra quyền.' }), {
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

  // Verify incident tồn tại, thuộc tenant, và memberId khớp
  const { data: incident, error: incidentError } = await supabaseAdmin
    .from('incidents')
    .select('id')
    .eq('id', incidentId)
    .eq('tenant_id', tenantId)
    .eq('member_id', memberId)
    .single()

  if (incidentError || !incident) {
    return new Response(JSON.stringify({ error: 'Incident không tồn tại.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // INSERT in-app notification cho member — service role bypass RLS
  const { error: notifError } = await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id:   memberId,
    type:      'appeal_reviewed',
    message:   '📋 Manager đã xem xét và thêm ghi chú về incident của bạn. Xem chi tiết để biết kết quả.',
    link_to:   `/incidents/${incidentId}`,
  })

  if (notifError) {
    console.error('[notify-outcome-note] notification insert error:', notifError)
    return new Response(JSON.stringify({ error: 'Không thể gửi thông báo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
