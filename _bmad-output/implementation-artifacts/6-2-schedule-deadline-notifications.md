# Story 6.2: Schedule Deadline Notifications

**Status:** review
**Epic:** 6 — Smart Notifications
**Story ID:** 6.2
**Story Key:** 6-2-schedule-deadline-notifications
**Created:** 2026-03-25

---

## Story

As a member,
I want to be reminded before the schedule deadline and notified if I miss it,
So that I rarely forget to register my schedule and my manager is always informed.

---

## Acceptance Criteria

**Given** pg_cron job `remind-schedule-submission` chạy (Chủ nhật 8PM ICT = 13:00 UTC)
**When** member chưa submit lịch cho tuần tới
**Then** member nhận in-app notification type `schedule_reminder`: "Nhắc nhở: Hạn đăng ký lịch tuần tới là [deadline time]. Hãy đăng ký ngay!"
**And** Resend gửi email reminder cùng nội dung đến member

**Given** pg_cron job `deadline-missed-notify` chạy (Chủ nhật 17:04 UTC = Mon 00:04 ICT)
**When** member vẫn chưa submit lịch
**Then** member nhận in-app notification type `schedule_missed` về việc bỏ lỡ deadline
**And** Manager/Owner nhận in-app notification: "[Member name] chưa đăng ký lịch tuần mới."
**And** cả hai đều nhận email notification qua Resend

**Given** member đã submit lịch trước deadline
**When** bất kỳ pg_cron job nào chạy
**Then** member đó KHÔNG nhận reminder hay missed notification

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Phân chia trách nhiệm giữa Story 2.4 và Story 6.2

**Story 2.4 (`auto_create_missing_schedules` RPC)** đã xử lý:
- Tạo `schedule_weeks` trống cho members chưa submit
- INSERT in-app notification `schedule_missed` cho member: `"Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."`
- INSERT in-app notification `schedule_missed` cho managers/owners: `"[name] chưa đăng ký lịch tuần mới."`
- Có idempotent guard: `created_at >= now() - interval '2 days'`

**Story 6.2 (notify-schedule-reminder Edge Function)** cần thêm:
- **`schedule_reminder` action**: IN-APP + EMAIL (chưa có gì)
- **`deadline_missed` action**: EMAIL (in-app đã do 2.4 xử lý, nhưng function vẫn nên insert in-app với idempotent guard để đảm bảo đủ điều kiện nếu 2.4 chưa chạy vì lý do nào đó)

### Thứ tự chạy pg_cron (Sunday ICT)
```
20:00 (13:00 UTC) → remind-schedule-submission  → action: "schedule_reminder"
23:59 (16:59 UTC) → auto-create-empty-schedule  → auto_create_missing_schedules (in-app notify)
00:04+1d (17:04 UTC) → deadline-missed-notify   → action: "deadline_missed" (email + in-app backup)
```

---

## Scope

### Duy nhất 1 file cần sửa

| File | Việc cần làm |
|------|-------------|
| `supabase/functions/notify-schedule-reminder/index.ts` | Thay thế stub bằng implementation đầy đủ |

**KHÔNG cần:**
- Tạo migration mới (tất cả tables, enum types, RLS đã tồn tại)
- Sửa pg_cron migration (đã schedule đúng rồi)
- Sửa frontend (in-app notifications đã hiện qua Story 6.1)
- Sửa `_shared/` files

---

## Tasks / Subtasks

### Edge Function: notify-schedule-reminder

- [x] Task 1: Implement `action: "schedule_reminder"` — reminder trước deadline
  - [x] Gọi helper `getNextMondayISO(new Date())` để tính tuần tới
  - [x] Query tất cả tenants
  - [x] Với mỗi tenant: query active members chưa có schedule_slots cho tuần tới
  - [x] Tính deadline time từ tenant config (xem logic bên dưới)
  - [x] INSERT in-app notification type `schedule_reminder` (idempotent guard: `created_at >= now() - interval '1 day'`)
  - [x] Gọi `sendEmail()` từ `../_shared/resend.ts` cho từng member chưa submit
  - [x] Return `{ ok: true, reminded_count: N }`

- [x] Task 2: Implement `action: "deadline_missed"` — sau khi bỏ lỡ deadline
  - [x] Tính `weekOf = getNextMondayISO(new Date())`
  - [x] Query tất cả tenants
  - [x] Với mỗi tenant: query active members chưa có schedule_slots cho tuần `weekOf` (schedule_weeks có thể đã tồn tại do auto-create job)
  - [x] INSERT in-app notification `schedule_missed` cho member (idempotent guard giống auto_create_missing_schedules)
  - [x] INSERT in-app notification `schedule_missed` cho managers/owners (idempotent guard giống auto_create_missing_schedules)
  - [x] Gọi `sendEmail()` cho member VÀ tất cả managers/owners
  - [x] Return `{ ok: true, notified_count: N }`

- [x] Task 3: Auth check & error handling
  - [x] Verify `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` — giống pattern trong `notify-schedule-change/index.ts`
  - [x] Unknown action → 400 (không return 200)
  - [x] Errors → 500 + `console.error`

- [x] Task 4: Kiểm tra local (không có pg_cron local)
  - [x] Deploy function: `npx supabase functions serve notify-schedule-reminder`
  - [x] Test bằng curl với service_role_key
  - [x] Verify notifications xuất hiện trong DB
  - [x] Verify emails gửi (hoặc log RESEND_API_KEY not set nếu không có key)

---

## Implementation Guide

### Helper Functions (copy/reuse từ notify-schedule-change)

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'

// Đã có trong notify-schedule-change — copy vào function này
function getNextMondayISO(now: Date): string {
  const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString().slice(0, 10)
}
```

### Auth Pattern (copy từ notify-schedule-change)

```typescript
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // ...
})
```

### Query: Members chưa submit schedule

```typescript
// Dùng cho cả schedule_reminder và deadline_missed
const weekOf = getNextMondayISO(new Date())

// Query tenants
const { data: tenants } = await supabaseAdmin
  .from('tenants')
  .select('id, name, timezone, schedule_deadline_day, schedule_deadline_hour')

// Với mỗi tenant, query members chưa có slots cho tuần tới
const { data: members } = await supabaseAdmin
  .from('tenant_members')
  .select('user_id, users!inner(full_name, email, timezone)')
  .eq('tenant_id', tenant.id)
  .eq('status', 'active')
  .not('user_id', 'in', `(
    SELECT DISTINCT ss.user_id
    FROM schedule_slots ss
    JOIN schedule_weeks sw ON ss.week_id = sw.id
    WHERE sw.tenant_id = '${tenant.id}'
      AND sw.week_of = '${weekOf}'
  )`)
```

> **Lưu ý:** Supabase JS client không hỗ trợ subquery NOT IN trực tiếp. Dùng `supabaseAdmin.rpc()` hoặc query raw SQL qua `supabaseAdmin.from('...').select()` với `.not()` approach. Cách đơn giản nhất: query 2 bước — (1) lấy user_ids đã submit, (2) lấy active members không nằm trong list đó.

**Cách thực tế với 2 queries:**

```typescript
// Step 1: Lấy user_ids đã có slots cho tuần tới
const { data: submitted } = await supabaseAdmin
  .from('schedule_slots')
  .select('user_id, schedule_weeks!inner(week_of, tenant_id)')
  .eq('schedule_weeks.tenant_id', tenant.id)
  .eq('schedule_weeks.week_of', weekOf)

const submittedUserIds = new Set((submitted ?? []).map(s => s.user_id))

// Step 2: Lấy active members không nằm trong submitted set
const { data: allMembers } = await supabaseAdmin
  .from('tenant_members')
  .select('user_id, role, users!inner(full_name, email)')
  .eq('tenant_id', tenant.id)
  .eq('status', 'active')

const pendingMembers = (allMembers ?? []).filter(m => !submittedUserIds.has(m.user_id))
```

### Tính Deadline Time cho Schedule Reminder

```typescript
// tenants.schedule_deadline_day = 0 (Sunday), schedule_deadline_hour = 23
// Deadline là Sunday 23:59 ICT của tuần hiện tại (tuần trước next Monday)
// weekOf là Monday → Sunday trước đó = weekOf - 1 ngày

function computeDeadlineDisplay(weekOf: string, tenant: {
  timezone: string
  schedule_deadline_hour: number
}): string {
  // Deadline Sunday = weekOf - 1 day
  const deadlineDate = new Date(weekOf + 'T00:00:00Z')
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() - 1)
  const deadlineStr = deadlineDate.toISOString().slice(0, 10) +
    ` ${String(tenant.schedule_deadline_hour).padStart(2, '0')}:59 (${tenant.timezone})`
  return deadlineStr
  // Ví dụ: "2026-03-29 23:59 (Asia/Ho_Chi_Minh)"
}
```

### Notification Messages

**`schedule_reminder` (in-app cho member):**
```
"Nhắc nhở: Hạn đăng ký lịch tuần tới là [deadline_display]. Hãy đăng ký ngay!"
```

**`schedule_missed` (in-app cho member, dùng cùng message với auto_create):**
```
"Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."
```

**`schedule_missed` (in-app cho manager/owner):**
```
"[full_name] chưa đăng ký lịch tuần mới."
```

### Idempotent Guard khi INSERT notifications

```typescript
// Kiểm tra trước khi insert để tránh duplicate (giống pattern trong auto_create_missing_schedules)
const { data: existing } = await supabaseAdmin
  .from('notifications')
  .select('id')
  .eq('tenant_id', tenant.id)
  .eq('user_id', member.user_id)
  .eq('type', 'schedule_reminder') // hoặc 'schedule_missed'
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .limit(1)

if (!existing || existing.length === 0) {
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenant.id,
    user_id: member.user_id,
    type: 'schedule_reminder',
    message: `Nhắc nhở: Hạn đăng ký lịch tuần tới là ${deadlineDisplay}. Hãy đăng ký ngay!`,
    link_to: '/schedule',
  })
}
```

### Email Templates

**Schedule Reminder Email:**
```typescript
await sendEmail({
  to: member.users.email,
  subject: '[TekSpace] Nhắc nhở: Đăng ký lịch làm việc tuần tới',
  html: `
    <h2>Nhắc nhở đăng ký lịch</h2>
    <p>Xin chào <strong>${member.users.full_name}</strong>,</p>
    <p>Bạn chưa đăng ký lịch làm việc cho tuần tới.</p>
    <p><strong>Hạn chót:</strong> ${deadlineDisplay}</p>
    <p><a href="${appUrl}/schedule">Đăng ký ngay →</a></p>
    <p>TekSpace</p>
  `,
})
```

**Deadline Missed Email (member):**
```typescript
await sendEmail({
  to: member.users.email,
  subject: '[TekSpace] Bạn đã bỏ lỡ hạn đăng ký lịch',
  html: `
    <h2>Bạn đã bỏ lỡ hạn đăng ký lịch</h2>
    <p>Xin chào <strong>${member.users.full_name}</strong>,</p>
    <p>Lịch làm việc tuần tới chưa được đăng ký. Lịch trống đã được tạo tự động.</p>
    <p><a href="${appUrl}/schedule">Cập nhật lịch ngay →</a></p>
    <p>TekSpace</p>
  `,
})
```

**Deadline Missed Email (manager):**
```typescript
await sendEmail({
  to: manager.users.email,
  subject: `[TekSpace] ${member.users.full_name} chưa đăng ký lịch tuần mới`,
  html: `
    <h2>Thành viên chưa đăng ký lịch</h2>
    <p>Xin chào <strong>${manager.users.full_name}</strong>,</p>
    <p><strong>${member.users.full_name}</strong> chưa đăng ký lịch làm việc cho tuần tới.</p>
    <p><a href="${appUrl}/schedule/manage">Xem lịch nhóm →</a></p>
    <p>TekSpace</p>
  `,
})
```

**App URL:** `const appUrl = Deno.env.get('APP_URL') ?? 'https://tekspace.io'`

### Lấy managers/owners trong deadline_missed

```typescript
const managers = (allMembers ?? []).filter(
  m => (m.role === 'owner' || m.role === 'manager') && m.user_id !== missedMember.user_id
)
```

---

## DB Schema Reference (Đã tồn tại — KHÔNG tạo migration)

```sql
-- notifications table (từ 20260323000008_create_notifications.sql)
id, tenant_id, user_id, type (notification_type enum), message, is_read, link_to, created_at

-- notification_type enum values đã có:
'schedule_reminder', 'schedule_missed', 'schedule_changed',
'daily_report_reminder', 'member_removed', 'invite_sent',
'invite_accepted', 'invite_expired', 'incident_logged',
'appeal_submitted', 'appeal_reviewed'

-- tenants table (liên quan):
timezone (text), schedule_deadline_day (smallint, default 0 = Sunday),
schedule_deadline_hour (smallint, default 23)

-- tenant_members table (liên quan):
user_id, tenant_id, role (owner/manager/member), status (active/inactive)

-- schedule_weeks table:
id, tenant_id, week_of (date = Monday), deadline (timestamptz), is_locked

-- schedule_slots table:
id, tenant_id, user_id, week_id (FK schedule_weeks), slot_date, start_time, duration_minutes
```

---

## Shared Files Reference

| File | Mục đích |
|------|---------|
| `supabase/functions/_shared/cors.ts` | CORS headers — import `{ corsHeaders }` |
| `supabase/functions/_shared/supabase-admin.ts` | Service role client — import `{ supabaseAdmin }` |
| `supabase/functions/_shared/resend.ts` | Email sending — import `{ sendEmail }` |
| `supabase/functions/notify-schedule-change/index.ts` | Reference pattern cho auth check + action routing |

---

## Anti-Patterns — TRÁNH

- ❌ **KHÔNG** tạo Supabase client mới — dùng `supabaseAdmin` từ `_shared/`
- ❌ **KHÔNG** tạo `sendEmail` helper mới — dùng từ `_shared/resend.ts`
- ❌ **KHÔNG** gọi `getNextMondayISO` khác biệt — copy đúng logic từ `notify-schedule-change`
- ❌ **KHÔNG** bỏ idempotent guard khi INSERT notifications → duplicate notifications
- ❌ **KHÔNG** return 200 khi action không xác định → trả 400
- ❌ **KHÔNG** tạo migration mới — tất cả tables và types đã tồn tại
- ❌ **KHÔNG** sửa frontend — realtime subscription trong Story 6.1 tự nhận notification mới

---

## Learnings từ Story 6.1

- `notifications` table đã có Realtime enabled (migration `20260324000012_enable_notifications_realtime.sql`) → notifications INSERT từ Edge Function sẽ tự trigger realtime update ở frontend ngay lập tức
- `notifications_insert_policy`: `WITH CHECK (tenant_id = current_tenant_id() AND user_id = auth.uid())` — chỉ áp dụng cho authenticated users. **Edge Function dùng service_role → bypass RLS hoàn toàn** → có thể INSERT notifications cho bất kỳ user nào
- Pattern test Edge Function local: `curl -X POST http://localhost:54321/functions/v1/notify-schedule-reminder -H "Authorization: Bearer <service_role_key>" -H "Content-Type: application/json" -d '{"action":"schedule_reminder"}'`

---

## Testing Checklist

- [ ] Curl test `schedule_reminder` action → verify in-app notifications được insert + email sent (hoặc logged)
- [ ] Curl test `deadline_missed` action → verify in-app cho member + managers, email cho cả 2 phía
- [ ] Idempotency: chạy cùng action 2 lần trong 24h → verify không duplicate notifications
- [ ] Member đã submit schedule → verify KHÔNG nhận notification
- [ ] Unknown action → verify response 400
- [ ] No auth → verify response 401
- [ ] `npx supabase test db` vẫn PASS sau khi deploy (không có migration mới nên chắc chắn pass)

---

## Ghi chú bổ sung

**Tại sao `deadline_missed` cần insert in-app notifications dù Story 2.4 đã làm?**
Story 2.4 (`auto_create_missing_schedules`) chạy trước `deadline-missed-notify` ~5 phút. Nếu vì lý do nào đó `auto_create_empty` job failed hoặc không insert được notifications, `deadline_missed` action sẽ là safety net. Idempotent guard đảm bảo không duplicate nếu 2.4 đã chạy thành công.

**Email delivery khi dev local:**
`RESEND_API_KEY` thường không set ở local → `sendEmail()` trong `_shared/resend.ts` log warning `"[resend] RESEND_API_KEY not set — email not sent"` và return stub. Đây là behavior đúng — không cần fix.

---

## Dev Agent Record

### Implementation Notes

- Thay thế stub `notify-schedule-reminder/index.ts` bằng implementation đầy đủ
- Cả 2 actions (`schedule_reminder`, `deadline_missed`) dùng chung helper `getSubmittedUserIds()` — query 2 bước: (1) lấy `week_id` từ `schedule_weeks`, (2) lấy distinct `user_id` từ `schedule_slots`
- `schedule_weeks` có thể không tồn tại lúc reminder fires (8PM Sunday) vì chưa có ai submit → `getSubmittedUserIds()` trả về `Set rỗng` → tất cả active members đều pending → correct behavior
- Auth pattern giống `notify-schedule-change/index.ts`: so sánh Authorization header với `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- Idempotent guard: `schedule_reminder` dùng 24h window, `schedule_missed` dùng 2d window (khớp với `auto_create_missing_schedules`)
- Email gửi bằng `try/catch` non-blocking — email failure không làm rollback in-app notification

### Test Results

| Test | Expected | Actual | Pass |
|------|---------|--------|------|
| No auth | 401 | 401 | ✅ |
| Unknown action | 400 `"Unknown action: bogus"` | 400 | ✅ |
| `schedule_reminder` | 200, reminded_count=5 | 200, reminded_count=5 | ✅ |
| `deadline_missed` | 200, notified_count=5 | 200, notified_count=5 | ✅ |
| Idempotency (lần 2) | counts không tăng | 5 + 14 giữ nguyên | ✅ |
| DB notifications content | messages đúng format | Verified ✅ | ✅ |
| supabase test db (60 tests) | PASS | PASS | ✅ |

---

## File List

- `supabase/functions/notify-schedule-reminder/index.ts` — REPLACED stub với full implementation

---

## Change Log

- 2026-03-25: Implement notify-schedule-reminder Edge Function — `schedule_reminder` + `deadline_missed` actions với in-app notifications + Resend email, idempotent guards, auth check
