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

  let body: { incidentId?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { incidentId, tenantId } = body
  if (!incidentId || !tenantId) {
    return new Response(JSON.stringify({ error: 'incidentId và tenantId là bắt buộc.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify incident tồn tại, thuộc tenant, và caller là victim
  const { data: incident, error: incidentError } = await supabaseAdmin
    .from('incidents')
    .select('id, created_at, member_id')
    .eq('id', incidentId)
    .eq('tenant_id', tenantId)
    .single()

  if (incidentError || !incident) {
    return new Response(JSON.stringify({ error: 'Incident không tồn tại.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Chỉ victim của incident mới được appeal
  if (incident.member_id !== caller.id) {
    return new Response(JSON.stringify({ error: 'Forbidden — chỉ victim của incident mới được appeal.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Lấy full_name của caller để ghi vào notification message
  const { data: callerProfile } = await supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', caller.id)
    .single()

  const callerName = callerProfile?.full_name ?? 'Thành viên'
  const incidentDate = new Date(incident.created_at)
  const formattedDate = `${String(incidentDate.getDate()).padStart(2, '0')}/${String(incidentDate.getMonth() + 1).padStart(2, '0')}/${incidentDate.getFullYear()}`

  // Lấy danh sách owner/manager trong tenant (không bao gồm caller)
  const { data: managers, error: managersError } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'manager'])
    .eq('status', 'active')
    .neq('user_id', caller.id)

  if (managersError) {
    console.error('[notify-appeal] managers query error:', managersError)
    return new Response(JSON.stringify({ error: 'Lỗi khi truy vấn managers.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Không có manager → trả về success (không cần notify)
  if (!managers?.length) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // INSERT notification cho tất cả owner/manager bằng service role (bypass RLS)
  const notifications = managers.map((m) => ({
    tenant_id: tenantId,
    user_id:   m.user_id,
    type:      'appeal_submitted' as const,
    message:   `${callerName} đã gửi appeal cho incident ngày ${formattedDate}.`,
    link_to:   '/incidents',
  }))

  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert(notifications)

  if (notifError) {
    console.error('[notify-appeal] notification insert error:', notifError)
    return new Response(JSON.stringify({ error: 'Không thể gửi thông báo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
