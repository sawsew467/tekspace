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

  let body: { tenantId?: string; memberId?: string; incidentId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { tenantId, memberId, incidentId } = body
  if (!tenantId || !memberId || !incidentId) {
    return new Response(JSON.stringify({ error: 'tenantId, memberId và incidentId là bắt buộc.' }), {
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

  // Verify incidentId thuộc đúng tenantId và memberId — tránh trigger notification giả
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
    type:      'incident_logged',
    message:   'Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents.',
    link_to:   '/incidents',
  })

  if (notifError) {
    console.error('[notify-incident] notification insert error:', notifError)
    return new Response(JSON.stringify({ error: 'Không thể gửi thông báo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
