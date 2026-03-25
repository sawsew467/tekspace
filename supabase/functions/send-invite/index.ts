import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Xác thực caller — decode JWT trực tiếp (Kong đã verify signature rồi)
    //    Không gọi auth.getUser() để tránh JWT issuer mismatch trong local dev
    const user = getUserFromJwt(req.headers.get('Authorization'))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { tenantId, email } = await req.json()

    if (!tenantId || !email) {
      return new Response(JSON.stringify({ error: 'tenantId và email là bắt buộc' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Kiểm tra caller có phải owner/manager của tenant không
    const { data: membership } = await supabaseAdmin
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || !['owner', 'manager'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // P13 — Kiểm tra email đã là active member trong tenant chưa
    // Tránh gửi invite cho người đã là thành viên
    const { data: existingMemberships } = await supabaseAdmin
      .from('tenant_members')
      .select('id, users!inner(email)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('users.email', email)

    if (existingMemberships && existingMemberships.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Email này đã là thành viên của team.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Lấy tên tenant và tên người invite cho email
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    const { data: inviterUser } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const inviterName = inviterUser?.full_name || 'Quản lý'

    // 4. Generate secure token (64 chars hex — > 32 chars required by constraint)
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // 5. INSERT tenant_invites
    const { data: invite, error: insertError } = await supabaseAdmin
      .from('tenant_invites')
      .insert({
        tenant_id: tenantId,
        invited_by: user.id,
        email,
        token,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError) {
      // UNIQUE INDEX (tenant_id, email) WHERE status = 'pending' → duplicate invite
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Email này đã có lời mời đang chờ xử lý.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw insertError
    }

    // 6. Gửi email invite với tên người invite (AC3 Story 6.4)
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
    const teamName = tenant?.name ?? 'team'

    await sendEmail({
      to: email,
      subject: `${inviterName} mời bạn vào ${teamName} trên TekSpace`,
      html: `
        <p>${inviterName} mời bạn tham gia <strong>${teamName}</strong> trên TekSpace.</p>
        <p>
          <a href="${appUrl}/accept-invite?token=${token}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
            Chấp nhận lời mời
          </a>
        </p>
        <p style="color:#71717a;font-size:14px;">Link có hiệu lực trong 48 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      `,
    })

    return new Response(JSON.stringify({ ok: true, inviteId: invite.id, token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-invite] error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
