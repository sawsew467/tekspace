import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

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

  // Auth check: chỉ cho phép service_role — pg_cron gọi với service_role key
  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Guard: req.json() có thể trả về null nếu body là "null" — destructure an toàn
    const rawBody = await req.json().catch(() => ({}))
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
    const { action } = body as { action?: string }

    if (action === 'auto_create_empty') {
      const weekOf = getNextMondayISO(new Date())

      const { data, error } = await supabaseAdmin.rpc(
        'auto_create_missing_schedules',
        { p_week_of: weekOf }
      )

      if (error) throw error
      console.log('[auto_create_empty] result:', data)

      return new Response(JSON.stringify({ ok: true, result: data }), {
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
