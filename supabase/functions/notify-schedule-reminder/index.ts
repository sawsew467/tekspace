import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://tekspace.io'

// ----------------------------------------------------------------
// Type helpers
// ----------------------------------------------------------------
type TenantRow = {
  id: string
  name: string
  timezone: string
  schedule_deadline_day: number
  schedule_deadline_hour: number
}

type MemberRow = {
  user_id: string
  role: string
  users: { full_name: string; email: string }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Escape HTML special characters để tránh XSS khi inject user data vào email body.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Tính Monday của tuần kế tiếp từ ngày hiện tại (UTC).
 * pg_cron fires Chủ nhật (day=0) → +1 ngày → Monday tới.
 * Xử lý tường minh từng case để tránh edge case khi test thủ công vào Monday.
 */
function getNextMondayISO(now: Date): string {
  const day = now.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
  // day=0 (Sun): +1 → Monday tuần này (cron fire chính thức)
  // day=1 (Mon): +7 → Monday tuần sau (nếu test vào Monday, tính tuần tiếp)
  // day=2-6: next Monday
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day) % 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

/**
 * Trả về chuỗi mô tả deadline hiển thị trong notification.
 * Dùng schedule_deadline_day (từ tenant config) để tính đúng ngày deadline —
 * không hard-code Sunday.
 * Ví dụ: "2026-03-29 23:59 (Asia/Ho_Chi_Minh)"
 */
function computeDeadlineDisplay(
  weekOf: string,
  tenant: Pick<TenantRow, 'timezone' | 'schedule_deadline_day' | 'schedule_deadline_hour'>
): string {
  // Số ngày trước Monday (day=1) để đến đúng deadline_day:
  //   deadline_day=0 (Sun): 1 ngày trước Monday
  //   deadline_day=6 (Sat): 2 ngày trước Monday
  //   deadline_day=1 (Mon): 7 ngày (= previous Monday)
  const daysBack = ((1 - tenant.schedule_deadline_day) + 7) % 7 || 7
  const deadlineDate = new Date(weekOf + 'T00:00:00Z')
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() - daysBack)
  const dateStr = deadlineDate.toISOString().slice(0, 10)
  const hourStr = String(tenant.schedule_deadline_hour).padStart(2, '0')
  return `${dateStr} ${hourStr}:59 (${tenant.timezone})`
}

/**
 * Lấy Set<user_id> của những members đã submit schedule cho weekOf trong tenant.
 * Nếu schedule_weeks chưa tồn tại → trả về Set rỗng (không ai submit).
 * Throws nếu có DB error — caller phải handle thay vì silently treat all-as-pending.
 */
async function getSubmittedUserIds(tenantId: string, weekOf: string): Promise<Set<string>> {
  const { data: weekRow, error: weekError } = await supabaseAdmin
    .from('schedule_weeks')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('week_of', weekOf)
    .maybeSingle()

  if (weekError) {
    console.error('[getSubmittedUserIds] week query error:', weekError)
    throw weekError
  }

  if (!weekRow?.id) return new Set()

  const { data: slots, error: slotsError } = await supabaseAdmin
    .from('schedule_slots')
    .select('user_id')
    .eq('week_id', weekRow.id)
    .eq('tenant_id', tenantId)

  if (slotsError) {
    console.error('[getSubmittedUserIds] slots query error:', slotsError)
    throw slotsError
  }

  return new Set((slots ?? []).map((s: { user_id: string }) => s.user_id))
}

// ----------------------------------------------------------------
// Action: schedule_reminder
// Gửi nhắc nhở cho members chưa submit lịch trước deadline
// ----------------------------------------------------------------

async function handleScheduleReminder(weekOf: string): Promise<{ reminded_count: number }> {
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, timezone, schedule_deadline_day, schedule_deadline_hour')

  if (tenantsError) throw tenantsError

  let totalCount = 0
  // Idempotent guard: skip nếu đã notify trong 24h qua (cả in-app lẫn email)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  for (const tenant of (tenants ?? []) as TenantRow[]) {
    let submittedUserIds: Set<string>
    try {
      submittedUserIds = await getSubmittedUserIds(tenant.id, weekOf)
    } catch {
      console.error(`[schedule_reminder] cannot get submitted users for tenant=${tenant.id}, skipping`)
      continue
    }

    const deadlineDisplay = computeDeadlineDisplay(weekOf, tenant)

    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('tenant_members')
      .select('user_id, role, users!inner(full_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')

    if (membersError) {
      console.error(`[schedule_reminder] members error tenant=${tenant.id}:`, membersError)
      continue
    }

    const pendingMembers = ((allMembers ?? []) as MemberRow[]).filter(
      (m) => !submittedUserIds.has(m.user_id)
    )

    for (const member of pendingMembers) {
      const message = `Nhắc nhở: Hạn đăng ký lịch tuần tới là ${deadlineDisplay}. Hãy đăng ký ngay!`

      // Idempotent check: nếu đã gửi trong 24h → skip cả in-app lẫn email
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', member.user_id)
        .eq('type', 'schedule_reminder')
        .gte('created_at', cutoff)
        .limit(1)

      if (existing && existing.length > 0) continue

      const { error: insertErr } = await supabaseAdmin.from('notifications').insert({
        tenant_id: tenant.id,
        user_id: member.user_id,
        type: 'schedule_reminder',
        message,
        link_to: '/schedule',
      })
      if (insertErr) {
        console.error(`[schedule_reminder] insert error user=${member.user_id}:`, insertErr)
        continue
      }

      // Email chỉ gửi khi in-app insert thành công — tránh email trùng khi re-run
      const safeName = escapeHtml(member.users.full_name)
      try {
        await sendEmail({
          to: member.users.email,
          subject: '[TekSpace] Nhắc nhở: Đăng ký lịch làm việc tuần tới',
          html: `
            <h2>Nhắc nhở đăng ký lịch</h2>
            <p>Xin chào <strong>${safeName}</strong>,</p>
            <p>Bạn chưa đăng ký lịch làm việc cho tuần tới.</p>
            <p><strong>Hạn chót:</strong> ${deadlineDisplay}</p>
            <p><a href="${APP_URL}/schedule">Đăng ký ngay →</a></p>
            <p>TekSpace</p>
          `,
        })
      } catch (emailErr) {
        console.error(`[schedule_reminder] email error ${member.users.email}:`, emailErr)
      }

      totalCount++
    }
  }

  return { reminded_count: totalCount }
}

// ----------------------------------------------------------------
// Action: deadline_missed
// Notify members + managers sau khi bỏ lỡ deadline đăng ký lịch
// ----------------------------------------------------------------

async function handleDeadlineMissed(weekOf: string): Promise<{ notified_count: number }> {
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, timezone')

  if (tenantsError) throw tenantsError

  let totalCount = 0
  // Guard 2 ngày — khớp với auto_create_missing_schedules để không tạo duplicate
  const cutoff2d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  for (const tenant of (tenants ?? []) as Pick<TenantRow, 'id' | 'name' | 'timezone'>[]) {
    let submittedUserIds: Set<string>
    try {
      submittedUserIds = await getSubmittedUserIds(tenant.id, weekOf)
    } catch {
      console.error(`[deadline_missed] cannot get submitted users for tenant=${tenant.id}, skipping`)
      continue
    }

    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('tenant_members')
      .select('user_id, role, users!inner(full_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')

    if (membersError) {
      console.error(`[deadline_missed] members error tenant=${tenant.id}:`, membersError)
      continue
    }

    const members = (allMembers ?? []) as MemberRow[]
    const pendingMembers = members.filter((m) => !submittedUserIds.has(m.user_id))
    const managers = members.filter((m) => m.role === 'owner' || m.role === 'manager')

    for (const member of pendingMembers) {
      // 1. In-app notification cho member
      // Safety net: auto_create_missing_schedules (2.4) có thể đã insert — idempotent guard ngăn duplicate
      const memberMessage =
        'Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể.'

      const { data: existingMember } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', member.user_id)
        .eq('type', 'schedule_missed')
        .gte('created_at', cutoff2d)
        .limit(1)

      // Nếu đã notify trong 2 ngày → skip cả in-app lẫn email cho member này
      if (existingMember && existingMember.length > 0) continue

      const { error: insertErr } = await supabaseAdmin.from('notifications').insert({
        tenant_id: tenant.id,
        user_id: member.user_id,
        type: 'schedule_missed',
        message: memberMessage,
        link_to: '/schedule',
      })
      if (insertErr) {
        // Thêm continue: tránh gửi email khi in-app insert fail → inconsistent state
        console.error(`[deadline_missed] insert member notif error user=${member.user_id}:`, insertErr)
        continue
      }

      // 2. Email cho member (chỉ gửi khi in-app insert thành công)
      const safeMemberName = escapeHtml(member.users.full_name)
      try {
        await sendEmail({
          to: member.users.email,
          subject: '[TekSpace] Bạn đã bỏ lỡ hạn đăng ký lịch',
          html: `
            <h2>Bạn đã bỏ lỡ hạn đăng ký lịch</h2>
            <p>Xin chào <strong>${safeMemberName}</strong>,</p>
            <p>Lịch làm việc tuần tới chưa được đăng ký. Lịch trống đã được tạo tự động.</p>
            <p><a href="${APP_URL}/schedule">Cập nhật lịch ngay →</a></p>
            <p>TekSpace</p>
          `,
        })
      } catch (emailErr) {
        console.error(`[deadline_missed] member email error ${member.users.email}:`, emailErr)
      }
      totalCount++ // đếm member

      // 3. In-app + email cho từng manager/owner (không self-notify)
      for (const mgr of managers) {
        if (mgr.user_id === member.user_id) continue

        // message dùng raw full_name cho in-app (không escape HTML trong plain text)
        const mgrMessage = `${member.users.full_name} chưa đăng ký lịch tuần mới.`

        // Dùng message làm một phần dedup key vì manager nhận N notifications
        // (một per pending member) — cần phân biệt từng member cụ thể
        const { data: existingMgr } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('user_id', mgr.user_id)
          .eq('type', 'schedule_missed')
          .eq('message', mgrMessage)
          .gte('created_at', cutoff2d)
          .limit(1)

        if (existingMgr && existingMgr.length > 0) continue

        const { error: mgrInsertErr } = await supabaseAdmin.from('notifications').insert({
          tenant_id: tenant.id,
          user_id: mgr.user_id,
          type: 'schedule_missed',
          message: mgrMessage,
          link_to: '/schedule',
        })
        if (mgrInsertErr) {
          console.error(`[deadline_missed] insert mgr notif error user=${mgr.user_id}:`, mgrInsertErr)
          continue
        }

        // Email cho manager chỉ gửi khi in-app insert thành công
        const safeMgrName = escapeHtml(mgr.users.full_name)
        const safeMemberNameForMgr = escapeHtml(member.users.full_name)
        try {
          await sendEmail({
            to: mgr.users.email,
            subject: `[TekSpace] ${member.users.full_name} chưa đăng ký lịch tuần mới`,
            html: `
              <h2>Thành viên chưa đăng ký lịch</h2>
              <p>Xin chào <strong>${safeMgrName}</strong>,</p>
              <p><strong>${safeMemberNameForMgr}</strong> chưa đăng ký lịch làm việc cho tuần tới.</p>
              <p><a href="${APP_URL}/schedule/manage">Xem lịch nhóm →</a></p>
              <p>TekSpace</p>
            `,
          })
        } catch (emailErr) {
          console.error(`[deadline_missed] mgr email error ${mgr.users.email}:`, emailErr)
        }
        totalCount++ // đếm manager
      }
    }
  }

  return { notified_count: totalCount }
}

// ----------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth check: chỉ cho phép service_role — pg_cron gọi với service_role key.
  // Reject ngay nếu SUPABASE_SERVICE_ROLE_KEY env var chưa được set (không fallback về '').
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!serviceRoleKey || !authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const rawBody = await req.json().catch(() => ({}))
    const body =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
    const { action } = body as { action?: string }

    const weekOf = getNextMondayISO(new Date())

    if (action === 'schedule_reminder') {
      const result = await handleScheduleReminder(weekOf)
      console.log('[schedule_reminder] result:', result)
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'deadline_missed') {
      const result = await handleDeadlineMissed(weekOf)
      console.log('[deadline_missed] result:', result)
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Action không xác định → 400
    console.warn('[notify-schedule-reminder] unknown action:', action)
    return new Response(
      JSON.stringify({ error: `Unknown action: ${String(action)}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('[notify-schedule-reminder] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
