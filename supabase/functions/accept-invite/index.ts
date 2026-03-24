import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { token, validateOnly } = body

    if (!token) {
      return new Response(JSON.stringify({ error: 'token là bắt buộc' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Tra cứu invite bằng token (dùng supabaseAdmin để bypass RLS)
    const { data: invite, error: lookupError } = await supabaseAdmin
      .from('tenant_invites')
      .select('id, tenant_id, email, status, expires_at')
      .eq('token', token)
      .single()

    if (lookupError || !invite) {
      return new Response(JSON.stringify({ error: 'Lời mời không hợp lệ.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Kiểm tra trạng thái và hạn dùng
    if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: 'Lời mời đã hết hạn. Vui lòng liên hệ manager để được invite lại.',
        }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. validateOnly=true → trả về thông tin invite để hiển thị UI (không cần auth)
    if (validateOnly) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('name')
        .eq('id', invite.tenant_id)
        .single()

      return new Response(
        JSON.stringify({
          tenantId: invite.tenant_id,
          tenantName: tenant?.name ?? '',
          email: invite.email,
          status: invite.status,
          expiresAt: invite.expires_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Accept path: P1 — decode JWT trực tiếp (Kong đã verify signature rồi)
    //    Không gọi auth.getUser() để tránh JWT issuer mismatch trong local dev
    const user = getUserFromJwt(req.headers.get('Authorization'))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. P2 — Xác minh email của user khớp với email trong invite
    //    Ngăn chặn trường hợp user B accept invite dành cho user A
    if (user.email !== invite.email) {
      return new Response(
        JSON.stringify({ error: 'Lời mời không dành cho tài khoản này.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. INSERT tenant_members (bypass RLS với admin client)
    //    userId lấy từ JWT đã xác thực, không từ request body
    const { error: memberError } = await supabaseAdmin.from('tenant_members').insert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: 'member',
      status: 'active',
    })

    // Bỏ qua lỗi unique constraint nếu membership đã tồn tại (idempotent accept)
    if (memberError && memberError.code !== '23505') {
      throw memberError
    }

    // 7. P7 — Cập nhật invite status → accepted (kiểm tra kết quả)
    const { error: updateError } = await supabaseAdmin
      .from('tenant_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    if (updateError) {
      // Membership đã được tạo — log lỗi nhưng tiếp tục để tránh orphan state.
      // Token vẫn có thể dùng lại nhưng step 6 sẽ ignore 23505 (idempotent).
      console.error('[accept-invite] Failed to update invite status:', updateError)
    }

    return new Response(JSON.stringify({ ok: true, tenantId: invite.tenant_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[accept-invite] error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
