# Story 6.4: Event-Based Notifications

**Status:** done
**Epic:** 6 — Smart Notifications
**Story ID:** 6.4
**Story Key:** 6-4-event-based-notifications
**Created:** 2026-03-25

---

## Story

As a user,
I want to be instantly notified when important events happen — schedule changes, team changes — without delay,
So that I always have up-to-date information without needing to refresh.

---

## Acceptance Criteria

**AC1 — Schedule changed → Manager nhận in-app + email:**

**Given** member thay đổi lịch đã đăng ký (update hoặc delete slot, có hoặc không có emergency override)
**When** change được save (RPC thành công)
**Then** Edge Function `notify-schedule-change` được gọi ngay lập tức (fire-and-forget từ `schedule.service.ts`)
**And** Manager nhận in-app notification: "[Member name] đã thay đổi lịch làm việc. Lý do: [reason]." ✅ (đã có via RPC)
**And** Manager nhận email notification qua Resend với cùng thông tin ← **PHẦN CÒN THIẾU cần implement**

**AC2 — Member removed → friendly in-app notification:**

**Given** Owner/Manager remove một member khỏi tenant
**When** remove action được thực hiện
**Then** member nhận in-app notification thân thiện trước khi session bị invalidate
**And** nội dung: "Bạn đã được xóa khỏi [Team Name]. Cảm ơn bạn đã tham gia!" ← **FIX message trong remove-member**

**AC3 — Invite sent → Resend email với inviter name:**

**Given** Owner/Manager gửi invite cho member mới
**When** invite được tạo
**Then** Edge Function `send-invite` gửi email ngay lập tức qua Resend ✅ (đã có)
**And** email bao gồm: tên team, **tên người invite**, và invite link valid 48h ← **FIX: thêm inviter name**

---

## Tasks / Subtasks

- [x] Task 1 — Edge Function `notify-schedule-change`: thêm action `notify_schedule_change` (AC1)
  - [x] 1.1 Rewrite `supabase/functions/notify-schedule-change/index.ts` với dual-auth (service role cho auto_create_empty, JWT cho notify_schedule_change)
  - [x] 1.2 Query managers/owners trong tenant kèm email từ `users` table
  - [x] 1.3 Gửi Resend email cho từng manager (per-item try/catch, không block response)

- [x] Task 2 — `schedule.service.ts`: fire-and-forget Edge Function call (AC1)
  - [x] 2.1 Thêm helper `fireNotifyScheduleChange(tenantId, reason, isEmergencyOverride)` (fire-and-forget, không await)
  - [x] 2.2 Thêm optional param `tenantId?` vào `updateSlotWithReason` + gọi helper sau RPC
  - [x] 2.3 Thêm optional param `tenantId?` vào `deleteSlotWithReason` + gọi helper sau RPC

- [x] Task 3 — Update hooks để truyền tenantId (AC1)
  - [x] 3.1 `use-update-slot.ts`: thêm `tenantId?: string` vào factory param, truyền vào `ScheduleService.updateSlotWithReason`
  - [x] 3.2 `use-delete-slot-with-reason.ts`: thêm `tenantId?: string` vào factory param, truyền vào `ScheduleService.deleteSlotWithReason`
  - [x] 3.3 `schedule.tsx`: truyền `activeTenantId` vào cả hai hooks

- [x] Task 4 — Fix `remove-member/index.ts` notification message (AC2)
  - [x] 4.1 Thay message "Bạn đã bị xóa khỏi..." → "Bạn đã được xóa khỏi [Team]. Cảm ơn bạn đã tham gia!"

- [x] Task 5 — `send-invite/index.ts`: thêm inviter name vào email (AC3)
  - [x] 5.1 Fetch `full_name` của người invite từ `users` table
  - [x] 5.2 Cập nhật subject và body email với inviter name

---

## Phân tích hiện trạng — RẤT QUAN TRỌNG đọc trước khi code

### Cái gì ĐÃ HOẠT ĐỘNG (không được đụng vào!)

| Tính năng | File | Trạng thái |
|-----------|------|------------|
| In-app notification khi schedule thay đổi | `supabase/migrations/20260324000015_fix_update_slot_duration_check.sql` (update_slot_with_reason) + `20260324000011_schedule_change_rpcs.sql` (delete_slot_with_reason) | ✅ DONE — RPC đã INSERT notifications cho tất cả managers |
| In-app notification khi member bị remove | `supabase/functions/remove-member/index.ts` line 127-133 | ✅ DONE — nhưng message sai (AC2) |
| Invite email | `supabase/functions/send-invite/index.ts` | ✅ DONE — nhưng thiếu inviter name (AC3) |
| notifications table + RLS | `supabase/migrations/20260323000008_create_notifications.sql` + `20260324000004_fix_notifications_insert_policy.sql` | ✅ DONE |
| notification_type enum | includes: `schedule_changed`, `member_removed`, `invite_sent` | ✅ DONE |
| resend.ts helper | `supabase/functions/_shared/resend.ts` | ✅ DONE |
| getUserFromJwt helper | `supabase/functions/_shared/jwt.ts` | ✅ DONE |

### Cái gì CẦN IMPLEMENT

| Task | File cần sửa | Ghi chú |
|------|-------------|---------|
| AC1: Email cho managers khi schedule thay đổi | `supabase/functions/notify-schedule-change/index.ts` | Thêm action `notify_schedule_change` — query managers, gửi Resend email |
| AC1: Gọi Edge Function sau khi RPC thành công | `src/features/schedule/services/schedule.service.ts` | fire-and-forget sau `updateSlotWithReason` và `deleteSlotWithReason` |
| AC2: Fix remove message | `supabase/functions/remove-member/index.ts` | Thay "bị xóa" → "được xóa" + thêm "Cảm ơn bạn đã tham gia!" |
| AC3: Thêm inviter name vào email | `supabase/functions/send-invite/index.ts` | Fetch full_name từ users table, thêm vào email body |

---

## Scope — 4 files thay đổi, 0 migration mới

| File | Việc cần làm |
|------|-------------|
| `supabase/functions/notify-schedule-change/index.ts` | **THAY THẾ TOÀN BỘ** — Thêm action `notify_schedule_change`: auth via `getUserFromJwt`, query managers, gửi Resend email |
| `src/features/schedule/services/schedule.service.ts` | Thêm fire-and-forget Edge Function call sau `updateSlotWithReason` và `deleteSlotWithReason` |
| `supabase/functions/remove-member/index.ts` | Fix notification message text (1 dòng thay đổi) |
| `supabase/functions/send-invite/index.ts` | Fetch inviter's full_name từ users table + thêm vào email HTML |

**KHÔNG cần:**
- Migration mới — notification_type enum và notifications table đã đủ
- RLS policy mới — Edge Functions dùng service role, bypass RLS
- Component/route mới — không có UI thay đổi
- Hook mới — không cần mutation hook mới
- Schema mới — không có form thay đổi

---

## Implementation Details

### Task 1: `notify-schedule-change/index.ts` — Thêm action `notify_schedule_change`

**Hiện tại:** File chỉ có action `auto_create_empty` (pg_cron auto-create empty schedule). Auth check dùng service role key (Bearer check).

**Vấn đề quan trọng về auth:**
- Action `auto_create_empty` được gọi bởi pg_cron với service role key → giữ nguyên auth Bearer check
- Action `notify_schedule_change` mới được gọi bởi **client browser** với user JWT → cần `getUserFromJwt` pattern (như `send-invite`)
- Hai auth patterns này PHẢI coexist trong cùng một file

**Giải pháp:** Check `Authorization` header: nếu là service role key → allow auto_create_empty; nếu là JWT → allow notify_schedule_change

```typescript
// notify-schedule-change/index.ts — REWRITE TOÀN BỘ

import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

// Giữ nguyên helper getNextMondayISO từ file cũ
function getNextMondayISO(now: Date): string {
  const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.json().catch(() => ({}))
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
    const { action } = body as { action?: string }

    // ── action: auto_create_empty (pg_cron caller — service role auth) ──────
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

    // ── action: notify_schedule_change (client caller — JWT auth) ────────────
    if (action === 'notify_schedule_change') {
      // Auth via JWT (getUserFromJwt — tránh JWT issuer mismatch trong local dev)
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

      // Lấy tên member thay đổi lịch
      const { data: memberUser } = await supabaseAdmin
        .from('users')
        .select('full_name, email')
        .eq('id', user.id)
        .single()
      const memberName = memberUser?.full_name || 'Thành viên'

      // Query tất cả managers/owners trong tenant (kèm email) — KHÔNG self-notify
      const { data: managers } = await supabaseAdmin
        .from('tenant_members')
        .select('user_id, users!inner(full_name, email)')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'manager'])
        .eq('status', 'active')
        .neq('user_id', user.id)

      if (!managers || managers.length === 0) {
        console.log('[notify_schedule_change] no managers to notify, tenant:', tenantId)
        return new Response(JSON.stringify({ ok: true, emailsSent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Gửi email cho từng manager
      const message = isEmergencyOverride
        ? `${memberName} đã dùng Emergency Override để thay đổi lịch làm việc. Lý do: ${reason}`
        : `${memberName} đã thay đổi lịch làm việc. Lý do: ${reason}`

      let emailsSent = 0
      for (const manager of managers) {
        const managerEmail = (manager.users as { email: string })?.email
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
          // Log lỗi nhưng không throw — không để lỗi email block response
          console.error('[notify_schedule_change] email error for', managerEmail, emailErr)
        }
      }

      console.log(`[notify_schedule_change] emails sent: ${emailsSent}/${managers.length}`)
      return new Response(JSON.stringify({ ok: true, emailsSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Action không xác định
    console.warn('[notify-schedule-change] unknown action:', action)
    return new Response(JSON.stringify({ error: `Unknown action: ${String(action)}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[notify-schedule-change] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Lưu ý quan trọng về `getUserFromJwt`:** Xem `_shared/jwt.ts` để hiểu signature. Nó nhận `Authorization` header string và trả về `{ id: string, ... } | null`.

---

### Task 2: `schedule.service.ts` — Fire-and-forget Edge Function call

**Pattern chuẩn từ architecture.md:** Edge Function calls phải nằm trong `services/` — không gọi trực tiếp từ component/hook.

**Approach:** Dùng `supabase.functions.invoke()` sau RPC call. KHÔNG await (fire-and-forget) để tránh block UX nếu Edge Function fail.

**Cần thêm import:** `supabase` đã được import trong file rồi.

```typescript
// Thêm helper function ở đầu file (sau imports, trước ScheduleService object):
async function fireNotifyScheduleChange(tenantId: string, reason: string, isEmergencyOverride: boolean): Promise<void> {
  // fire-and-forget: không await, không throw
  supabase.functions
    .invoke('notify-schedule-change', {
      body: { action: 'notify_schedule_change', tenantId, reason, isEmergencyOverride },
    })
    .catch((err) => {
      // Log nhưng không rethrow — notification email failure không block UX
      console.warn('[notify-schedule-change] fire-and-forget error:', err)
    })
}
```

**Cần lấy tenantId:** Trong `updateSlotWithReason` và `deleteSlotWithReason`, service hiện không nhận tenantId. Cần thêm param `tenantId` vào signature.

```typescript
// BEFORE:
updateSlotWithReason: async (
  slotId: string,
  newStartTimeUTC: Date,
  newDurationMinutes: number,
  reason: string,
  isEmergencyOverride: boolean = false
): Promise<void> => {

// AFTER — thêm tenantId:
updateSlotWithReason: async (
  slotId: string,
  newStartTimeUTC: Date,
  newDurationMinutes: number,
  reason: string,
  isEmergencyOverride: boolean = false,
  tenantId?: string   // optional để backward compatible
): Promise<void> => {
  const { error } = await supabase.rpc('update_slot_with_reason', {
    p_slot_id:               slotId,
    p_new_start_time:        newStartTimeUTC.toISOString(),
    p_new_duration_minutes:  newDurationMinutes,
    p_reason:                reason,
    p_is_emergency_override: isEmergencyOverride,
  })
  if (error) throw error

  // Fire-and-forget email notification (không block nếu fail)
  if (tenantId) {
    fireNotifyScheduleChange(tenantId, reason, isEmergencyOverride)
  }
},

// Tương tự cho deleteSlotWithReason:
deleteSlotWithReason: async (
  slotId: string,
  reason: string,
  isEmergencyOverride: boolean = false,
  tenantId?: string   // optional
): Promise<void> => {
  const { error } = await supabase.rpc('delete_slot_with_reason', {
    p_slot_id:               slotId,
    p_reason:                reason,
    p_is_emergency_override: isEmergencyOverride,
  })
  if (error) throw error

  if (tenantId) {
    fireNotifyScheduleChange(tenantId, reason, isEmergencyOverride)
  }
},
```

**Update callers:** Cần truyền tenantId từ `use-update-slot.ts` và `use-delete-slot-with-reason.ts`. Lấy tenantId từ `useAppStore` hoặc `useCurrentTenant` hook (xem pattern hiện có trong codebase).

```typescript
// Trong use-update-slot.ts — thêm tenantId vào mutationFn params
// Trong use-delete-slot-with-reason.ts — thêm tenantId vào mutationFn params
```

**CẢNH BÁO:** Verify cách lấy tenantId trong hooks. Kiểm tra file `src/lib/store.ts` hoặc `src/features/auth/` để tìm pattern chuẩn.

---

### Task 3: `remove-member/index.ts` — Fix notification message

Chỉ thay đổi **1 dòng** trong file:

```typescript
// BEFORE (line 131):
message: `Bạn đã bị xóa khỏi ${tenant?.name ?? 'team'}.`,

// AFTER:
message: `Bạn đã được xóa khỏi ${tenant?.name ?? 'team'}. Cảm ơn bạn đã tham gia!`,
```

**KHÔNG thay đổi gì khác** trong file này.

---

### Task 4: `send-invite/index.ts` — Thêm inviter name vào email

Cần fetch `full_name` của người invite từ `users` table và đưa vào email body.

```typescript
// Sau khi verify membership (line ~45), thêm:
// Lấy tên người invite
const { data: inviterUser } = await supabaseAdmin
  .from('users')
  .select('full_name')
  .eq('id', user.id)
  .single()
const inviterName = inviterUser?.full_name || 'Quản lý'

// Cập nhật email HTML (thay thế existing sendEmail call):
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
```

---

## Kiến trúc & Patterns phải tuân theo

### Auth Pattern trong Edge Functions

| Caller | Auth method | Example function |
|--------|-------------|-----------------|
| pg_cron (service role) | `authHeader === Bearer ${serviceRoleKey}` | `notify-schedule-change` (action auto_create_empty) |
| Client browser (user JWT) | `getUserFromJwt(req.headers.get('Authorization'))` | `send-invite`, và `notify_schedule_change` mới |
| KHÔNG DÙNG | `supabaseAdmin.auth.getUser()` | JWT issuer mismatch trong local dev |

### Fire-and-forget Pattern

```typescript
// ✅ ĐÚNG — fire-and-forget, không block
supabase.functions.invoke('notify-schedule-change', { body: { ... } })
  .catch((err) => console.warn('...', err))

// ❌ SAI — await sẽ block UX
await supabase.functions.invoke('notify-schedule-change', { body: { ... } })
```

### Edge Function Service Pattern (từ architecture.md)

```typescript
// Edge Function calls PHẢI nằm trong services/ — không gọi trực tiếp từ component/hook
// ✅ ĐÚNG: gọi từ schedule.service.ts
// ❌ SAI: gọi từ use-update-slot.ts hay schedule.tsx
```

### Notification message format

Theo RPC hiện có (`update_slot_with_reason`):
- Normal: `"{name} đã thay đổi lịch làm việc. Lý do: {reason}"`
- Emergency: `"{name} đã dùng Emergency Override để thay đổi lịch. Lý do: {reason}"`

Email notification phải consistent với in-app notification message format.

---

## Kiểm tra dependencies

### Xác minh tenantId availability trong hooks

Trước khi implement Task 2, cần kiểm tra cách lấy `tenantId` trong hooks:

```bash
grep -n "tenantId\|activeTenant\|useCurrentTenant\|useTenant\|useAppStore" \
  src/features/schedule/hooks/use-update-slot.ts \
  src/features/schedule/hooks/use-delete-slot-with-reason.ts \
  src/routes/_app/schedule.tsx
```

Nếu `schedule.tsx` đã có `tenantId`, truyền vào mutation vars. Nếu cần lấy từ store, verify pattern từ codebase.

### Verify users.email column

MCP đã xác nhận `users` table có column `email` (text). ✅

### Verify getUserFromJwt signature

```bash
cat supabase/functions/_shared/jwt.ts
```

Verify return type có `id` field để dùng làm `user.id`.

---

## Checklist Testing

```bash
# 1. Chạy toàn bộ DB tests
npx supabase test db
# Expected: tất cả tests PASS (không có migration mới nên không cần worry)

# 2. TypeScript check
npx tsc --noEmit
# Expected: 0 errors

# 3. Manual test: Schedule change email
# - Login as member, update/delete một slot với lý do
# - Kiểm tra manager nhận in-app notification (đã có)
# - Kiểm tra Resend dashboard / console log email được gửi

# 4. Manual test: Remove member
# - Login as owner, remove một member
# - Verify removed member nhận in-app: "...Cảm ơn bạn đã tham gia!"

# 5. Manual test: Invite email
# - Login as owner, invite một email mới
# - Verify email có tên người invite trong subject và body
```

---

## Learnings từ Story 6-3b (story trước)

1. **Pattern `getUserFromJwt` cho JWT auth trong Edge Functions**: Xem `send-invite/index.ts` làm template tham khảo (đặc biệt là cách handle `getUserFromJwt` và null check).

2. **Edge Function không cần `supabaseAdmin.auth.getUser()`**: Tránh hoàn toàn, luôn dùng `getUserFromJwt` cho client JWT auth.

3. **Supabase join syntax trong TypeScript**: Khi query với `.select('role, users!inner(email, full_name)')`, access kết quả qua `row.users as { email: string }`.

4. **Fire-and-forget error boundary**: Lỗi email không được throw ra ngoài — chỉ log và skip (pattern đã thấy trong nhiều Edge Functions).

5. **tsc --noEmit bắt buộc trước khi commit**: Verify TypeScript không có lỗi, đặc biệt khi thêm optional param vào function signature hiện có.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (1M context)

### Debug Log References

- `tsc --noEmit`: 0 errors ✅
- `npx supabase test db`: 63/63 tests PASS ✅

### Completion Notes List

- **AC1 (Schedule changed → email to managers):** `notify-schedule-change` Edge Function được rewrite với dual-auth pattern: `auto_create_empty` giữ service role auth (pg_cron), `notify_schedule_change` mới dùng `getUserFromJwt` (client JWT). Email gửi qua Resend tới tất cả managers/owners trong tenant, per-item try/catch để không block nếu 1 manager fail. `schedule.service.ts` thêm `fireNotifyScheduleChange()` helper (fire-and-forget, không await) và optional `tenantId?` param vào `updateSlotWithReason`/`deleteSlotWithReason`. Hooks và route `schedule.tsx` truyền `activeTenantId` từ `useTenantStore`.
- **AC2 (Member removed → friendly message):** Fix 1 dòng trong `remove-member/index.ts`: "bị xóa" → "được xóa" + thêm "Cảm ơn bạn đã tham gia!"
- **AC3 (Invite email với inviter name):** `send-invite/index.ts` fetch `full_name` từ `users` table, thêm vào email subject ("Quản lý mời bạn vào...") và body. Fallback về "Quản lý" nếu full_name trống.
- 0 migration mới — tất cả DB schema đã đủ từ trước.

### File List

- `supabase/functions/notify-schedule-change/index.ts` — rewrite: thêm action `notify_schedule_change` với JWT auth + Resend email delivery
- `src/features/schedule/services/schedule.service.ts` — thêm `fireNotifyScheduleChange` helper + optional `tenantId?` param vào `updateSlotWithReason` và `deleteSlotWithReason`
- `src/features/schedule/hooks/use-update-slot.ts` — thêm `tenantId?: string` vào factory param
- `src/features/schedule/hooks/use-delete-slot-with-reason.ts` — thêm `tenantId?: string` vào factory param
- `src/routes/_app/schedule.tsx` — truyền `activeTenantId ?? undefined` vào `useUpdateSlot` và `useDeleteSlotWithReason`
- `supabase/functions/remove-member/index.ts` — fix notification message (1 dòng)
- `supabase/functions/send-invite/index.ts` — fetch inviter `full_name`, update subject + body email
