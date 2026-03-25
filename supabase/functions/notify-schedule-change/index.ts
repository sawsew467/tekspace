import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

// Tính next Monday (tuần kế tiếp) từ current date
// Được thiết kế để gọi vào Chủ nhật (day=0) bởi pg_cron — day=0 → +1 ngày → đúng Monday tới
// UTC arithmetic: Sun(0)→+1 | Mon(1)→+7 | Tue(2)→+6 | … | Sat(6)→+2
function getNextMondayISO(now: Date): string {
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat  (pg_cron fires on Sunday → day=0)
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Guard: req.json() có thể trả về null nếu body là "null" — destructure an toàn
    const rawBody = await req.json().catch(() => ({}))
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
    const { action } = body as { action?: string }

    // ── action: auto_create_empty (pg_cron caller — service role auth) ────────
    if (action === 'auto_create_empty') {
      const authHeader = req.headers.get('Authorization')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const weekOf = getNextMondayISO(new Date())
      const { data, error } = await supabaseAdmin.rpc('auto_create_missing_schedules', {
        p_week_of: weekOf,
      })
      if (error) throw error
      console.log('[auto_create_empty] result:', data)

      return new Response(JSON.stringify({ ok: true, result: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── action: notify_schedule_change (client caller — JWT auth) ─────────────
    // Gọi bởi schedule.service.ts sau khi RPC update/delete slot thành công.
    // In-app notification đã được RPC insert trực tiếp vào DB (SECURITY DEFINER).
    // Edge Function này chỉ phụ trách EMAIL delivery qua Resend.
    if (action === 'notify_schedule_change') {
      // Auth via JWT decode (getUserFromJwt — tránh JWT issuer mismatch trong local dev)
      const user = getUserFromJwt(req.headers.get('Authorization'))
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { tenantId, reason, isEmergencyOverride } = body as {
        tenantId?: string
        reason?: string
        isEmergencyOverride?: boolean
      }

      if (!tenantId || !reason) {
        return new Response(JSON.stringify({ error: 'tenantId và reason là bắt buộc' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Lấy tên member thay đổi lịch (để hiển thị trong email)
      const { data: memberUser } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()
      const memberName = memberUser?.full_name || 'Thành viên'

      // Query tất cả managers/owners trong tenant kèm email — KHÔNG self-notify (neq user.id)
      const { data: managers } = await supabaseAdmin
        .from('tenant_members')
        .select('user_id, users!inner(full_name, email)')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'manager'])
        .eq('status', 'active')
        .neq('user_id', user.id)

      if (!managers || managers.length === 0) {
        console.log('[notify_schedule_change] no managers to email, tenant:', tenantId)
        return new Response(JSON.stringify({ ok: true, emailsSent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Compose email message — consistent với in-app notification format từ RPC
      const message = isEmergencyOverride
        ? `${memberName} đã dùng Emergency Override để thay đổi lịch làm việc. Lý do: ${reason}`
        : `${memberName} đã thay đổi lịch làm việc. Lý do: ${reason}`

      let emailsSent = 0
      for (const manager of managers) {
        const managerEmail = (manager.users as { full_name: string; email: string })?.email
        if (!managerEmail) continue

        try {
          await sendEmail({
            to: managerEmail,
            subject: `[TekSpace] ${memberName} đã thay đổi lịch làm việc`,
            html: `
              <p>${message}</p>
              <p style="color:#71717a;font-size:14px;">Đăng nhập vào TekSpace để xem lịch chi tiết.</p>
            `,
          })
          emailsSent++
        } catch (emailErr) {
          // Log lỗi nhưng không throw — không để lỗi email của 1 manager block toàn bộ
          console.error('[notify_schedule_change] email error for', managerEmail, emailErr)
        }
      }

      console.log(`[notify_schedule_change] emails sent: ${emailsSent}/${managers.length}`)
      return new Response(JSON.stringify({ ok: true, emailsSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Action không xác định → 400 (không trả 200 để tránh che lấp lỗi tích hợp)
    console.warn('[notify-schedule-change] unknown action:', action)
    return new Response(JSON.stringify({ error: `Unknown action: ${String(action)}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[notify-schedule-change] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
