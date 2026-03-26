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

  let body: { tenantId?: string; memberId?: string; incidentId?: string; outcome?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { tenantId, memberId, incidentId, outcome } = body
  if (!tenantId || !memberId || !incidentId || !outcome) {
    return new Response(
      JSON.stringify({ error: 'tenantId, memberId, incidentId và outcome là bắt buộc.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (outcome !== 'dismissed' && outcome !== 'upheld') {
    return new Response(
      JSON.stringify({ error: 'outcome phải là "dismissed" hoặc "upheld".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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
    // PGRST116 = "Results contain 0 rows" → caller không phải member → 403
    if (callerError.code === 'PGRST116') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
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
  const message = outcome === 'upheld'
    ? '⚠️ Incident của bạn đã được xử lý: Vi phạm được giữ nguyên.'
    : '✅ Incident của bạn đã được xử lý: Vi phạm đã được bỏ qua.'

  // P-7: Idempotency — dùng link_to có incidentId để detect duplicate
  const linkTo = `/incidents/${incidentId}`
  const { data: existing } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', memberId)
    .eq('type', 'incident_resolved')
    .eq('link_to', linkTo)
    .maybeSingle()

  if (existing) {
    // Notification đã tồn tại — bỏ qua (idempotent)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: notifError } = await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id:   memberId,
    type:      'incident_resolved',
    message,
    link_to:   linkTo,
  })

  if (notifError) {
    // P-3: Best-effort — notification fail không block resolution (đã INSERT thành công rồi)
    // Trả 200 thay vì 500, log để observability
    console.error('[notify-resolution] notification insert error:', notifError)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
