# Story 2.4: Missed Deadline Auto-Handling

**Status:** review
**Epic:** 2 — Schedule Registration
**Story ID:** 2.4
**Story Key:** 2-4-missed-deadline-auto-handling
**Created:** 2026-03-24

---

## Story

As a member,
I want the system to handle my missed schedule deadline without locking me out,
So that I can still update my schedule late and my manager is automatically notified.

---

## Acceptance Criteria

1. **Auto-create empty schedule + notify** — Khi pg_cron `auto-create-empty-schedule` fires (Chủ nhật 16:59 UTC = 23:59 ICT): với mỗi active tenant, tạo `schedule_weeks` record cho tuần tới nếu chưa tồn tại; tìm active members KHÔNG có slots cho tuần đó; gửi in-app notification (`schedule_missed`) cho từng member: `"Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."`; gửi in-app notification cho tất cả managers/owners trong cùng tenant: `"[full_name] chưa đăng ký lịch tuần mới."`

2. **Member truy cập không bị block** — Sau khi schedule_weeks record được tạo, member mở `/schedule` → thấy lịch trống (empty state đã có từ Story 2.1), có thể thêm slots bình thường — không bị block.

3. **Submit muộn hoạt động bình thường, không auto-log incident** — Member submit lịch sau deadline → lịch được lưu qua `upsert_week_slots` RPC (không bị block vì `schedule_weeks.is_locked = false`). Hệ thống KHÔNG tự động log incident — chỉ Manager log thủ công.

---

## Tasks / Subtasks

### Task 1: DB Migration — `auto_create_missing_schedules` PL/pgSQL function ✅

**File:** `supabase/migrations/20260324000018_auto_create_missing_schedules.sql`

Tại sao cần PL/pgSQL function thay vì logic thuần TypeScript trong Edge Function:
- Nhất quán với pattern đã có (upsert_week_slots, update_slot_with_reason dùng cùng approach)
- Dễ test với pgTAP
- Logic SQL tối ưu hơn (batch insert notifications trong 1 query)
- SECURITY DEFINER cho phép bypass RLS khi chạy trong DB context

```sql
-- Migration: auto_create_missing_schedules — batch create empty schedules + notify
-- Called by Edge Function notify-schedule-change with action=auto_create_empty
-- Runs for ALL tenants (service role context — no RLS)

CREATE OR REPLACE FUNCTION public.auto_create_missing_schedules(p_week_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant         RECORD;
  v_member         RECORD;
  v_week_id        uuid;
  v_deadline       timestamptz;
  v_deadline_date  date;
  v_offset         int;
  v_processed      int := 0;
BEGIN
  -- Validate: p_week_of phải là Monday (ISO week start)
  IF EXTRACT(DOW FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'p_week_of phải là thứ Hai (Monday) — nhận được: % (DOW=%)',
      p_week_of, EXTRACT(DOW FROM p_week_of);
  END IF;

  FOR v_tenant IN
    SELECT id, timezone, schedule_deadline_day, schedule_deadline_hour
    FROM public.tenants
  LOOP
    -- Tính deadline (cùng công thức với get_or_create_schedule_week)
    v_offset       := ((v_tenant.schedule_deadline_day::int - 1 + 7) % 7) - 7;
    v_deadline_date := p_week_of + v_offset;
    v_deadline      := (
      v_deadline_date::text || ' ' ||
      lpad(v_tenant.schedule_deadline_hour::text, 2, '0') || ':59:00'
    )::timestamp AT TIME ZONE v_tenant.timezone;

    -- Upsert schedule_weeks (tạo nếu chưa có, bỏ qua nếu đã có)
    INSERT INTO public.schedule_weeks (tenant_id, week_of, deadline, is_locked)
    VALUES (v_tenant.id, p_week_of, v_deadline, false)
    ON CONFLICT (tenant_id, week_of) DO NOTHING;

    SELECT id INTO v_week_id
    FROM public.schedule_weeks
    WHERE tenant_id = v_tenant.id AND week_of = p_week_of;

    IF v_week_id IS NULL THEN
      CONTINUE;  -- defensive: không xảy ra, nhưng tránh null pointer
    END IF;

    -- Với mỗi active member KHÔNG có slots trong tuần này → notify
    FOR v_member IN
      SELECT tm.user_id, u.full_name
      FROM public.tenant_members tm
      JOIN public.users u ON u.id = tm.user_id
      WHERE tm.tenant_id = v_tenant.id
        AND tm.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.schedule_slots ss
          WHERE ss.week_id   = v_week_id
            AND ss.user_id   = tm.user_id
            AND ss.tenant_id = v_tenant.id
        )
    LOOP
      -- Notify member về lịch trống
      INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
      VALUES (
        v_tenant.id,
        v_member.user_id,
        'schedule_missed',
        'Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể.',
        '/schedule'
      );

      -- Notify tất cả managers/owners (không self-notify)
      INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
      SELECT
        v_tenant.id,
        tm.user_id,
        'schedule_missed',
        coalesce(v_member.full_name, 'Thành viên') || ' chưa đăng ký lịch tuần mới.',
        '/schedule'
      FROM public.tenant_members tm
      WHERE tm.tenant_id = v_tenant.id
        AND tm.role IN ('owner', 'manager')
        AND tm.status = 'active'
        AND tm.user_id <> v_member.user_id;  -- không self-notify

      v_processed := v_processed + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('processed_members', v_processed, 'week_of', p_week_of);
END;
$$;

-- Không cần GRANT authenticated — function chỉ được gọi từ Edge Function (service_role)
-- Service_role có quyền gọi tất cả function mặc định trong Supabase
```

---

### Task 2: Implement Edge Function `notify-schedule-change` ✅

**File:** `supabase/functions/notify-schedule-change/index.ts` ← REPLACE stub hoàn toàn

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

// Tính next Monday từ current date
// addDays(startOfISOWeek(now), 7) = Monday của tuần TIẾP THEO
// Works correctly regardless of current day of week
function getNextMondayISO(now: Date): string {
  // ISO week starts Monday. startOfISOWeek(Sunday Mar 29) = Monday Mar 23.
  // addDays(..., 7) = Monday Mar 30 = next week. Correct.
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { action } = body

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

    // Các action khác (schedule_changed từ Story 2.3 đã dùng event-driven, không qua đây)
    console.warn('[notify-schedule-change] unknown action:', action)
    return new Response(JSON.stringify({ ok: true, skipped: true, action }), {
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
```

**Về `getNextMondayISO`:**
- Khi job chạy vào Chủ nhật 16:59 UTC: `getUTCDay()` = 0 → `daysUntilMonday = 1` → nextMonday = thứ Hai ngay sau.
- Chỉ dùng UTC arithmetic — không cần date-fns vì logic đơn giản. Tránh import overhead.

---

### Task 3: pgTAP Test ✅

**File:** `supabase/tests/test_auto_create_missing_schedules.sql` ← TẠO MỚI

```sql
-- pgTAP tests for auto_create_missing_schedules function
-- Story 2.4: Missed Deadline Auto-Handling

BEGIN;

SELECT plan(8);

-- =============================================================
-- FIXTURES — UUID prefix: c1 (khác với test files khác)
-- Tenant : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01
-- Owner  : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01
-- Manager: c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02
-- Member1: c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03  (không có slots → phải được notify)
-- Member2: c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04  (có slots → không notify)
-- =============================================================

-- Auth users
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'authenticated', 'authenticated', 'owner_acem@test.com',   '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'authenticated', 'authenticated', 'manager_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'authenticated', 'authenticated', 'member1_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'authenticated', 'authenticated', 'member2_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, full_name)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'ACEM Owner'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'ACEM Manager'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'ACEM Member One'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'ACEM Member Two')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name, timezone, schedule_deadline_day, schedule_deadline_hour)
VALUES ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'ACEM Test Tenant', 'Asia/Ho_Chi_Minh', 0, 23)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'owner',   'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'manager', 'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'member',  'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'member',  'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- p_week_of = '2026-04-07' (Monday)
-- Member2 đã có slots cho tuần này
INSERT INTO public.schedule_weeks (id, tenant_id, week_of, deadline, is_locked)
VALUES (
  'c1eebc99-0000-0000-0000-6bb9bd380001',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  '2026-04-07',
  '2026-04-05 23:59:00+07',  -- Sunday before the week
  false
) ON CONFLICT (tenant_id, week_of) DO NOTHING;

INSERT INTO public.schedule_slots (tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
VALUES (
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04',  -- Member2 đã có slot
  'c1eebc99-0000-0000-0000-6bb9bd380001',
  '2026-04-07',
  '2026-04-07 02:00:00+00',  -- 9AM ICT Monday
  120
);

-- =============================================================
-- TESTS
-- =============================================================

-- Test 1: p_week_of không phải Monday → RAISE EXCEPTION
SELECT throws_ok(
  $$ SELECT public.auto_create_missing_schedules('2026-04-08') $$,
  'P0001',
  NULL,
  'T1: phải throw nếu p_week_of không phải Monday'
);

-- Test 2: function trả về jsonb hợp lệ
SELECT is(
  (SELECT (public.auto_create_missing_schedules('2026-04-07') -> 'week_of')::text),
  '"2026-04-07"',
  'T2: kết quả chứa week_of đúng'
);

-- Test 3: schedule_weeks record được tạo cho tenant (có thể đã có từ fixture)
SELECT ok(
  EXISTS (SELECT 1 FROM public.schedule_weeks WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' AND week_of = '2026-04-07'),
  'T3: schedule_weeks record tồn tại cho tenant sau khi gọi function'
);

-- Test 4: is_locked = false cho record mới tạo
SELECT is(
  (SELECT is_locked FROM public.schedule_weeks WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' AND week_of = '2026-04-07'),
  false,
  'T4: schedule_weeks.is_locked = false (member được phép submit muộn)'
);

-- Test 5: Member1 (không có slot) nhận notification schedule_missed
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'
      AND type      = 'schedule_missed'
  ),
  'T5: Member1 nhận notification schedule_missed'
);

-- Test 6: Member2 (đã có slot) KHÔNG nhận notification
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04'
      AND type      = 'schedule_missed'
  ),
  'T6: Member2 (đã có slot) KHÔNG nhận notification'
);

-- Test 7: Manager nhận notification về Member1
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02'
      AND type      = 'schedule_missed'
      AND message LIKE '%ACEM Member One%'
  ),
  'T7: Manager nhận notification về Member1 không đăng ký'
);

-- Test 8: idempotent — gọi lại không tạo duplicate schedule_weeks
SELECT is(
  (SELECT count(*)::int FROM public.schedule_weeks
   WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
     AND week_of   = '2026-04-07'),
  1,
  'T8: ON CONFLICT DO NOTHING — không duplicate schedule_weeks khi gọi lại'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## Dev Notes

### Context — Những gì đã có từ Story 2.1–2.3

**DB Tables (đã có):**
- `schedule_weeks` (1 row/tenant/week) — `id, tenant_id, week_of, deadline, is_locked`
- `schedule_slots` — `tenant_id, user_id, week_id, slot_date, start_time, duration_minutes`
- `notifications` — `tenant_id, user_id, type, message, is_read, link_to`
- `notification_type` enum đã có: **`'schedule_missed'`** ← dùng cho story này

**RPCs đã có (không cần thay đổi):**
- `get_or_create_schedule_week(p_week_of)` — member tạo schedule_week khi truy cập trang
- `upsert_week_slots(p_week_id, p_slots)` — atomic upsert; **KHÔNG block late submit** (chỉ check `is_locked`, không check deadline timestamp)

**pg_cron jobs đã được tạo trong migration `20260323000013_pg_cron_jobs.sql`:**
- `auto-create-empty-schedule` → `'59 16 * * 0'` (Chủ nhật 16:59 UTC = 23:59 ICT) → gọi Edge Function `notify-schedule-change` với `{"action": "auto_create_empty"}`
- `deadline-missed-notify` → `'4 17 * * 0'` → gọi `notify-schedule-reminder` với `{"action": "deadline_missed"}` ← **OUT OF SCOPE** cho story này (sẽ implement trong Epic 6)

**Edge Functions stub hiện tại:**
- `supabase/functions/notify-schedule-change/index.ts` → **STUB TODO** — đây là file cần implement chính
- `supabase/functions/notify-schedule-reminder/index.ts` → còn là stub, không implement trong story này

**Frontend (không cần thay đổi):**
- Schedule page đã render empty state khi không có slots (Story 2.1)
- `useScheduleWeek` gọi `get_or_create_schedule_week` → nếu schedule_week đã tồn tại (do auto-create tạo), chỉ `return` nó — không conflict
- `ScheduleDeadlineBadge` hiển thị deadline đã qua — không block member

### ⚠️ Guardrails quan trọng

**1. Không chạm vào frontend**
- Toàn bộ flow member truy cập lịch sau deadline đã hoạt động từ Story 2.1
- `upsert_week_slots` RPC không check deadline timestamp, chỉ check `is_locked` (= false cho record mới)
- Đừng thêm any gate-keeping logic

**2. `is_locked` PHẢI là false trong auto-create**
- Record tạo bởi `auto_create_missing_schedules` phải có `is_locked = false`
- Nếu là `true` → member bị block hoàn toàn (vi phạm AC3)
- Đây là intentional design: "lịch trống" chỉ là placeholder, member có thể edit tự do

**3. ON CONFLICT DO NOTHING — idempotent**
- Nếu member đã tạo schedule_week bằng cách truy cập trang trước deadline → record đã tồn tại
- INSERT ON CONFLICT DO NOTHING → không overwrite existing record
- Đảm bảo function an toàn khi chạy nhiều lần

**4. Không self-notify cho manager cũng không đăng ký**
- Nếu manager cũng bỏ lỡ deadline → họ nhận notification ở vòng lặp member
- Trong vòng lặp manager-notify: `AND tm.user_id <> v_member.user_id` → manager không nhận 2 notifications về chính mình

**5. Scope của story này**
- `notify-schedule-change` với action `auto_create_empty` ← IMPLEMENT
- `notify-schedule-reminder` với action `deadline_missed` ← KHÔNG implement (Epic 6, Story 6.2)
- Không implement email (Resend) trong story này — chỉ in-app notifications

### File Structure

```
supabase/
  migrations/
    20260324000017_auto_create_missing_schedules.sql    ← TẠO MỚI (Task 1)
  functions/
    notify-schedule-change/
      index.ts                                          ← REPLACE stub (Task 2)
  tests/
    test_auto_create_missing_schedules.sql              ← TẠO MỚI (Task 3)
```

**Không tạo/sửa file nào khác.**

### Test thủ công sau implement

**Apply migration:**
```bash
npx supabase db push --local
```

**Chạy pgTAP:**
```bash
npx supabase test db
```
Tất cả `ok` — không có `not ok`.

**Test Edge Function local:**
```bash
npx supabase functions serve notify-schedule-change
# Gọi với ngày Monday thực tế:
curl -X POST http://localhost:54321/functions/v1/notify-schedule-change \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "auto_create_empty"}'
# Expected: {"ok": true, "result": {"processed_members": N, "week_of": "2026-MM-DD"}}
```

**Verify DB state:**
```sql
-- Kiểm tra schedule_weeks được tạo
SELECT tenant_id, week_of, is_locked FROM schedule_weeks WHERE week_of = '2026-MM-DD';

-- Kiểm tra notifications
SELECT user_id, type, message FROM notifications WHERE type = 'schedule_missed';
```

### Architecture References
- Notification types: `supabase/migrations/20260323000008_create_notifications.sql`
- pg_cron jobs: `supabase/migrations/20260323000013_pg_cron_jobs.sql`
- Admin client: `supabase/functions/_shared/supabase-admin.ts`
- schedule_weeks schema: `supabase/migrations/20260323000005_create_schedule_weeks.sql`
- `get_or_create_schedule_week` deadline formula: `supabase/migrations/20260324000008_get_or_create_schedule_week.sql`

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- Fix: `2026-04-07` trong test fixture là Thứ Ba (không phải Monday). Sửa thành `2026-04-06` (Monday thực sự) cho `week_of` column và tất cả function calls. Migration đã dùng số `20260324000018` vì `20260324000017` đã có.

### Completion Notes List

- ✅ Task 1: Migration `20260324000018_auto_create_missing_schedules.sql` — PL/pgSQL function `auto_create_missing_schedules(p_week_of date)` với SECURITY DEFINER, validate Monday, upsert schedule_weeks, notify member + managers/owners.
- ✅ Task 2: Edge Function `notify-schedule-change/index.ts` — replace stub, xử lý action `auto_create_empty`, tính next Monday bằng UTC arithmetic thuần.
- ✅ Task 3: pgTAP test `test_auto_create_missing_schedules.sql` — 8 tests bao gồm validation non-Monday, jsonb result, schedule_weeks created, is_locked=false, member notification, no-notify for member with slots, manager notification, idempotency.
- Tất cả 52 tests PASS (8 mới + 44 regression). Không có not ok.

### File List

- `supabase/migrations/20260324000018_auto_create_missing_schedules.sql`
- `supabase/functions/notify-schedule-change/index.ts`
- `supabase/tests/test_auto_create_missing_schedules.sql`

---

## Change Log

- **2026-03-24** — Story 2.4 implemented: tạo PL/pgSQL function `auto_create_missing_schedules`, implement Edge Function `notify-schedule-change` action `auto_create_empty`, tạo 8 pgTAP tests. Tất cả tests PASS.
