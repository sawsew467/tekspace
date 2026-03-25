# Story 6.3: Daily Report Reminder

**Status:** done
**Epic:** 6 — Smart Notifications
**Story ID:** 6.3
**Story Key:** 6-3-daily-report-reminder
**Created:** 2026-03-25

---

## Story

As a member,
I want to be reminded to submit my daily report each evening,
So that I don't forget to log my work and maintain the accountability loop.

---

## Acceptance Criteria

**Given** pg_cron job `remind-daily-report` chạy (hàng ngày 7PM ICT = 12:00 UTC)
**When** member chưa submit daily report cho ngày hôm nay
**Then** member nhận in-app notification type `daily_report_reminder`: "Nhắc nhở: Bạn chưa nộp daily report hôm nay."
**And** Resend gửi email reminder đến member

**Given** member đã submit daily report cho ngày hôm nay
**When** pg_cron job chạy
**Then** member đó KHÔNG nhận reminder

**Given** cron job gặp lỗi khi chạy (lỗi per-tenant)
**When** job fail ở một tenant
**Then** job tiếp tục xử lý các tenant còn lại (không dừng toàn bộ)
**And** lỗi được log để debug (idempotent guard đảm bảo re-run an toàn)

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Điểm quan trọng nhất: pg_cron đã route về notify-schedule-reminder

**Migration `20260323000013_pg_cron_jobs.sql`** đã tạo pg_cron job:
```sql
SELECT cron.schedule(
  'remind-daily-report',
  '0 12 * * *',              -- Hàng ngày 12:00 UTC = 19:00 ICT
  $$
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url', true) || '/notify-schedule-reminder',
    ...
    body    := '{"action": "daily_report_reminder"}'::jsonb
  )
  $$
);
```

**Hệ quả:** pg_cron đang gọi `/notify-schedule-reminder` với `action: "daily_report_reminder"`.
Nhưng function hiện tại chỉ handle `schedule_reminder` và `deadline_missed` → trả về **400** khi nhận `daily_report_reminder`.

**Story 6.3 chỉ cần làm một việc duy nhất:**
Thêm handler `action === 'daily_report_reminder'` vào `notify-schedule-reminder/index.ts`.

### Không cần migration mới

| Thành phần | Trạng thái |
|-----------|-----------|
| pg_cron job `remind-daily-report` | ✅ Đã tồn tại (migration 00013) |
| `notification_type` enum `daily_report_reminder` | ✅ Đã tồn tại (migration 00008) |
| `daily_reports` table | ✅ Đã tồn tại (migration 00007) |
| `notifications` table + RLS | ✅ Đã tồn tại (migration 00008) |
| Edge Function `notify-schedule-reminder` | ✅ Đã deployed (Story 6.2) — chỉ cần thêm action mới |

### "Hôm nay" tính theo timezone của tenant

pg_cron fires lúc 12:00 UTC. Với tenant `Asia/Ho_Chi_Minh` (UTC+7), lúc đó là 19:00 ICT — "hôm nay" trong ICT có cùng calendar date với UTC date. Nhưng để đúng với các tenant timezone khác, phải tính per-tenant:

```typescript
function getTodayInTz(timezone: string): string {
  // Dùng 'sv-SE' locale cho format YYYY-MM-DD chuẩn ISO
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date())
}
```

Ví dụ: `getTodayInTz('Asia/Ho_Chi_Minh')` lúc 12:00 UTC → `'2026-03-25'` (nếu đang là 25/3 19:00 ICT).

---

## Scope

### Duy nhất 1 file cần sửa

| File | Việc cần làm |
|------|-------------|
| `supabase/functions/notify-schedule-reminder/index.ts` | Thêm helper `getTodayInTz()` + function `handleDailyReportReminder()` + route trong main handler |

**KHÔNG cần:**
- Tạo migration mới (tất cả tables, enum types, RLS, pg_cron job đã tồn tại)
- Tạo Edge Function mới (route qua `notify-schedule-reminder` với action mới)
- Sửa frontend (Notification Center từ Story 6.1 tự hiển thị `daily_report_reminder`)
- Sửa `_shared/` files

---

## Tasks / Subtasks

### 1 — Thêm helper `getTodayInTz()`

- [x] Thêm hàm `getTodayInTz(timezone: string): string` vào section Helpers
- [x] Dùng `Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date())`
- [x] Đặt sau `getNextMondayISO()` (cùng section helpers)

### 2 — Implement `handleDailyReportReminder()`

- [x] Khai báo `async function handleDailyReportReminder(): Promise<{ reminded_count: number }>`
- [x] Query tất cả tenants: `id, name, timezone`
- [x] Loop mỗi tenant:
  - [x] Tính `todayISO = getTodayInTz(tenant.timezone)`
  - [x] Query `daily_reports` → lấy `user_id` đã submit hôm nay (`.eq('report_date', todayISO)`)
  - [x] Build `submittedIds: Set<string>` từ kết quả
  - [x] Query `tenant_members` active: `user_id, users!inner(full_name, email)`
  - [x] Filter ra `pendingMembers` (không nằm trong `submittedIds`)
  - [x] Loop mỗi `pendingMember`:
    - [x] Idempotent check: nếu đã có `daily_report_reminder` notification trong 24h → `continue`
    - [x] INSERT in-app notification type `daily_report_reminder`
    - [x] Email gửi bằng `try/catch` non-blocking (email failure không block in-app insert)
    - [x] `totalCount++` chỉ khi in-app insert thành công
- [x] Return `{ reminded_count: totalCount }`

### 3 — Thêm route trong main handler

- [x] Thêm `if (action === 'daily_report_reminder')` block sau `deadline_missed` block (trước unknown action return)
- [x] Call `handleDailyReportReminder()`, log result, return `200 { ok: true, ...result }`

### 4 — Test

- [x] Deploy function local: `npx supabase functions serve notify-schedule-reminder`
- [x] Test với curl (xem phần Testing Checklist)
- [x] `npx supabase test db` vẫn PASS (không có migration mới)

---

## Implementation Guide

### Toàn bộ code cần thêm vào `notify-schedule-reminder/index.ts`

#### Helper mới (thêm vào section Helpers, sau `computeDeadlineDisplay`)

```typescript
/**
 * Tính calendar date hôm nay theo timezone của tenant.
 * pg_cron fires 12:00 UTC → với timezone 'Asia/Ho_Chi_Minh' (UTC+7) = 19:00 → 'YYYY-MM-DD' của ngày đó.
 * Dùng 'sv-SE' locale để format chuẩn ISO (YYYY-MM-DD) không cần split thủ công.
 */
function getTodayInTz(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date())
}
```

#### Handler mới (thêm vào sau `handleDeadlineMissed`, trước Entry point)

```typescript
// ----------------------------------------------------------------
// Action: daily_report_reminder
// Nhắc nhở members chưa submit daily report hôm nay
// ----------------------------------------------------------------

async function handleDailyReportReminder(): Promise<{ reminded_count: number }> {
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, timezone')

  if (tenantsError) throw tenantsError

  let totalCount = 0
  // Idempotent guard: 24h — job chạy 1 lần/ngày, không gửi lại nếu đã notify trong 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  for (const tenant of (tenants ?? []) as Pick<TenantRow, 'id' | 'name' | 'timezone'>[]) {
    const todayISO = getTodayInTz(tenant.timezone) // 'YYYY-MM-DD' theo timezone tenant

    // Step 1: Lấy user_ids đã submit daily report hôm nay
    const { data: submitted, error: submittedError } = await supabaseAdmin
      .from('daily_reports')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .eq('report_date', todayISO)

    if (submittedError) {
      console.error(`[daily_report_reminder] submitted query error tenant=${tenant.id}:`, submittedError)
      continue // Không dừng toàn bộ — skip tenant này, xử lý tenant tiếp theo
    }

    const submittedIds = new Set((submitted ?? []).map((r: { user_id: string }) => r.user_id))

    // Step 2: Lấy tất cả active members của tenant
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('tenant_members')
      .select('user_id, users!inner(full_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')

    if (membersError) {
      console.error(`[daily_report_reminder] members error tenant=${tenant.id}:`, membersError)
      continue
    }

    // Step 3: Filter members chưa submit
    const pendingMembers = ((allMembers ?? []) as MemberRow[]).filter(
      (m) => !submittedIds.has(m.user_id)
    )

    for (const member of pendingMembers) {
      // Idempotent check: đã gửi trong 24h → skip
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', member.user_id)
        .eq('type', 'daily_report_reminder')
        .gte('created_at', cutoff)
        .limit(1)

      if (existing && existing.length > 0) continue

      // INSERT in-app notification
      const { error: insertErr } = await supabaseAdmin.from('notifications').insert({
        tenant_id: tenant.id,
        user_id: member.user_id,
        type: 'daily_report_reminder',
        message: 'Nhắc nhở: Bạn chưa nộp daily report hôm nay.',
        link_to: '/daily-report',
      })
      if (insertErr) {
        console.error(`[daily_report_reminder] insert error user=${member.user_id}:`, insertErr)
        continue // Không gửi email nếu in-app insert fail → tránh inconsistent state
      }

      // Email (non-blocking — email fail không rollback in-app notification)
      const safeName = escapeHtml(member.users.full_name)
      try {
        await sendEmail({
          to: member.users.email,
          subject: '[TekSpace] Nhắc nhở: Nộp daily report hôm nay',
          html: `
            <h2>Nhắc nhở nộp daily report</h2>
            <p>Xin chào <strong>${safeName}</strong>,</p>
            <p>Bạn chưa nộp daily report cho hôm nay.</p>
            <p>Hãy ghi lại công việc trong ngày để team luôn cập nhật tiến độ.</p>
            <p><a href="${APP_URL}/daily-report">Nộp report ngay →</a></p>
            <p>TekSpace</p>
          `,
        })
      } catch (emailErr) {
        console.error(`[daily_report_reminder] email error ${member.users.email}:`, emailErr)
      }

      totalCount++
    }
  }

  return { reminded_count: totalCount }
}
```

#### Route thêm vào main handler (thêm sau `deadline_missed` block, TRƯỚC unknown action return)

```typescript
    if (action === 'daily_report_reminder') {
      const result = await handleDailyReportReminder()
      console.log('[daily_report_reminder] result:', result)
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
```

### Vị trí chèn trong file hiện tại

```
// File structure sau khi thêm:

// Helpers section:
function escapeHtml() { ... }
function getNextMondayISO() { ... }
function computeDeadlineDisplay() { ... }
function getTodayInTz() { ... }        ← THÊM MỚI

// Action handlers:
async function getSubmittedUserIds() { ... }   // (helper)
async function handleScheduleReminder() { ... }
async function handleDeadlineMissed() { ... }
async function handleDailyReportReminder() { ... }   ← THÊM MỚI

// Entry point:
Deno.serve(async (req) => {
  ...auth check...

  if (action === 'schedule_reminder') { ... }
  if (action === 'deadline_missed') { ... }
  if (action === 'daily_report_reminder') { ... }   ← THÊM MỚI

  // Unknown action → 400
  return new Response(...)
})
```

---

## DB Schema Reference (Đã tồn tại — KHÔNG tạo migration)

```sql
-- daily_reports table (từ 20260323000007_create_daily_reports.sql)
id, tenant_id, user_id, report_date (date), tasks (jsonb), hours_logged (numeric),
is_late (boolean), submitted_at (timestamptz), created_at (timestamptz)
UNIQUE (tenant_id, user_id, report_date)  -- 1 report per member per day

-- notifications table (từ 20260323000008_create_notifications.sql)
id, tenant_id, user_id, type (notification_type enum), message, is_read, link_to, created_at

-- notification_type enum values — 'daily_report_reminder' ĐÃ tồn tại ✅
'schedule_reminder', 'schedule_missed', 'schedule_changed',
'daily_report_reminder',   ← đây
'member_removed', 'invite_sent', 'invite_accepted', 'invite_expired',
'incident_logged', 'appeal_submitted', 'appeal_reviewed'

-- tenants table (liên quan):
id, name, timezone (text, default 'Asia/Ho_Chi_Minh')
-- (daily_report_deadline_hour không cần cho story này — chỉ dùng cho is_late trigger)

-- tenant_members table (liên quan):
user_id, tenant_id, role, status (active/inactive)
```

---

## Shared Files Reference

| File | Mục đích |
|------|---------|
| `supabase/functions/_shared/cors.ts` | `corsHeaders` — đã import sẵn trong file |
| `supabase/functions/_shared/supabase-admin.ts` | `supabaseAdmin` — đã import sẵn |
| `supabase/functions/_shared/resend.ts` | `sendEmail({ to, subject, html })` — đã import sẵn |
| `supabase/functions/notify-schedule-reminder/index.ts` | File duy nhất cần sửa — thêm action mới |

---

## Learnings từ Story 6.2 (áp dụng cho Story 6.3)

- **escapeHtml()** đã có trong file — dùng lại cho tên user trong email (không khai báo lại)
- **Email gửi sau in-app insert thành công** — pattern nhất quán: `if (insertErr) { continue }` trước `sendEmail()`
- **Idempotent guard** = query `.gte('created_at', cutoff)` trước khi INSERT — tránh duplicate khi job bị trigger nhiều lần
- **`try/catch` quanh `sendEmail()`** — email failure không làm fail in-app notification
- **`RESEND_API_KEY` không set ở local** → `sendEmail()` log warning và return stub — đây là behavior đúng, không cần fix
- **Edge Function dùng `supabaseAdmin` (service_role)** → bypass RLS hoàn toàn → có thể INSERT notifications cho bất kỳ user nào
- **`notifications` table có Realtime enabled** → INSERT từ Edge Function tự trigger realtime update ở frontend

### Khác biệt so với Story 6.2

| Story 6.2 (schedule_reminder) | Story 6.3 (daily_report_reminder) |
|-------------------------------|----------------------------------|
| Check `schedule_slots` xem ai đã submit | Check `daily_reports` xem ai đã submit |
| `weekOf` tính bằng `getNextMondayISO()` | `todayISO` tính bằng `getTodayInTz(timezone)` |
| Idempotent guard 24h | Idempotent guard 24h (giống nhau) |
| link_to: `/schedule` | link_to: `/daily-report` |
| Chỉ chạy Chủ nhật | Chạy hàng ngày |

---

## Anti-Patterns — TRÁNH

- ❌ **KHÔNG** tạo migration mới — pg_cron job, notification type, và tất cả tables đã tồn tại
- ❌ **KHÔNG** tạo Edge Function mới — pg_cron đã route về `/notify-schedule-reminder`
- ❌ **KHÔNG** dùng UTC date cứng (`new Date().toISOString().slice(0, 10)`) cho "hôm nay" — phải dùng `getTodayInTz(tenant.timezone)` để hỗ trợ multi-timezone
- ❌ **KHÔNG** bỏ idempotent guard — job chạy hàng ngày, duplicate notification là UX xấu
- ❌ **KHÔNG** return 200 khi action không xác định — vẫn giữ `400 Unknown action` cho các action khác
- ❌ **KHÔNG** khai báo lại `escapeHtml()` hay `supabaseAdmin` — đã có sẵn trong file
- ❌ **KHÔNG** gửi email khi in-app insert fail — pattern: `if (insertErr) { continue }` trước `sendEmail()`
- ❌ **KHÔNG** sửa frontend — Notification Center (Story 6.1) tự hiển thị `daily_report_reminder` notifications

---

## Testing Checklist

```bash
# Deploy local
npx supabase functions serve notify-schedule-reminder

# Lấy service_role_key
SERVICE_KEY=$(npx supabase status | grep "service_role" | awk '{print $NF}')

# Test 1: Unknown action vẫn trả 400 (regression check)
curl -X POST http://localhost:54321/functions/v1/notify-schedule-reminder \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"bogus"}'
# Expected: 400 {"error":"Unknown action: bogus"}

# Test 2: daily_report_reminder action
curl -X POST http://localhost:54321/functions/v1/notify-schedule-reminder \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"daily_report_reminder"}'
# Expected: 200 {"ok":true,"reminded_count":N}

# Test 3: Verify notifications xuất hiện trong DB
# (Dùng Supabase Studio hoặc SQL)
SELECT type, message, user_id, created_at FROM notifications
WHERE type = 'daily_report_reminder'
ORDER BY created_at DESC LIMIT 10;
# Expected: rows với message = 'Nhắc nhở: Bạn chưa nộp daily report hôm nay.'

# Test 4: Idempotency — chạy lại ngay lập tức
curl -X POST http://localhost:54321/functions/v1/notify-schedule-reminder \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"daily_report_reminder"}'
# Expected: 200 {"ok":true,"reminded_count":0}  ← 0 vì đã notify trong 24h

# Test 5: Member đã submit report không nhận notification
# Insert test report vào DB trước, sau đó chạy action → verify member đó KHÔNG được notify

# Test 6: Regression — các action cũ vẫn hoạt động
curl -X POST ... -d '{"action":"schedule_reminder"}'   # vẫn phải trả 200
curl -X POST ... -d '{"action":"deadline_missed"}'     # vẫn phải trả 200

# Test 7: supabase test db (không có migration mới → chắc chắn pass)
npx supabase test db
# Expected: tất cả tests PASS
```

---

## Dev Agent Record

### Implementation Notes

- Thêm helper `getTodayInTz(timezone)` dùng `Intl.DateTimeFormat('sv-SE')` — chuẩn ISO YYYY-MM-DD, đúng per-tenant timezone, không cần split thủ công
- `handleDailyReportReminder()` hoàn toàn độc lập với các action cũ: query `daily_reports` (không phải `schedule_slots`), tính ngày hôm nay (không phải next Monday), route không nhận tham số `weekOf`
- Idempotent guard 24h — job chạy hàng ngày, đảm bảo không duplicate khi retry
- Per-tenant error isolation: `continue` trong loop → tenant lỗi không ảnh hưởng tenant khác
- Email non-blocking: `try/catch` quanh `sendEmail()`, email fail không rollback in-app notification
- Để auth check pass khi test local: cần cả `apikey: <sb_secret>` VÀ `Authorization: Bearer <sb_secret>` — `apikey` cần cho Supabase Edge Runtime routing, `Authorization` cho function's own auth check
- Local service role key format: `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` (từ `npx supabase status`)

### Test Results

| Test | Expected | Actual | Pass |
|------|---------|--------|------|
| No auth | 401 | 401 | ✅ |
| Unknown action | 400 `{"error":"Unknown action: bogus"}` | 400 | ✅ |
| `daily_report_reminder` (lần 1) | 200, reminded_count=5 | 200, reminded_count=5 | ✅ |
| Idempotency (lần 2) | 200, reminded_count=0 | 200, reminded_count=0 | ✅ |
| Member đã submit (1 user) | reminded_count=4 | 200, reminded_count=4 | ✅ |
| User đã submit KHÔNG nhận notification | [] | [] | ✅ |
| Regression: `schedule_reminder` | 200, ok=true | 200, ok=true | ✅ |
| Regression: `deadline_missed` | 200, ok=true | 200, ok=true | ✅ |
| `npx supabase test db` (60 tests) | PASS | PASS | ✅ |
| DB notifications: message, link_to đúng | Verified | Verified | ✅ |

---

## File List

- `supabase/functions/notify-schedule-reminder/index.ts` — thêm `getTodayInTz()` + `handleDailyReportReminder()` + route `daily_report_reminder`

---

## Change Log

- 2026-03-25: Story created — thêm `daily_report_reminder` action vào `notify-schedule-reminder` Edge Function
- 2026-03-25: Implement — thêm `getTodayInTz()` helper + `handleDailyReportReminder()` + route trong main handler; tất cả 10 tests PASS, supabase test db 60/60 PASS
- 2026-03-25: Code review fixes — P-1: idempotent guard đổi sang calendar-day anchor (`todayCutoff`); P-2: wrap `getTodayInTz()` trong try/catch per-tenant; P-3: destructure `error` từ idempotent check query; P-4/P-5: thêm `.limit(10000)` cho `daily_reports` và `tenant_members` queries; P-6: null-guard `member.users.email` trước `sendEmail()`; IG-1: skip cuối tuần (T7/CN) theo mặc định với TODO cho per-tenant config
