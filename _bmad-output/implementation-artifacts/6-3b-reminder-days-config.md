# Story 6.3b: Per-Tenant Reminder Days Configuration

**Status:** review
**Epic:** 6 — Smart Notifications
**Story ID:** 6.3b
**Story Key:** 6-3b-reminder-days-config
**Created:** 2026-03-25

---

## Story

As an owner/manager,
I want to configure which days of the week the daily report reminder fires for my team,
So that members don't receive spam reminders on non-working days (weekends or mid-week off days).

---

## Acceptance Criteria

**Given** tenant chưa cấu hình `reminder_days`
**When** pg_cron job `remind-daily-report` chạy
**Then** reminder chỉ gửi vào T2–T6 (default Mon–Fri)

**Given** owner/manager đã cấu hình `reminder_days = [1,2,4,5,6]` (nghỉ T4 và T7 → vẫn làm T7 ở đây là sai, giả sử nghỉ CN)
**When** pg_cron job chạy vào ngày T4
**Then** member KHÔNG nhận reminder (vì T4 không có trong reminder_days)

**Given** owner/manager set `reminder_days = []` (tắt hoàn toàn)
**When** pg_cron job chạy
**Then** không ai nhận reminder (mọi ngày đều skip)

**Given** member không phải owner/manager
**When** truy cập Team Settings
**Then** toggle reminder_days bị disabled / không save được (RLS UPDATE policy đã đủ)

---

## Scope — 5 files

| File | Việc cần làm |
|------|-------------|
| `supabase/migrations/20260325000004_add_reminder_days_to_tenants.sql` | ADD COLUMN `reminder_days smallint[]` với DEFAULT + CHECK constraint |
| `supabase/functions/notify-schedule-reminder/index.ts` | Cập nhật `TenantRow` type, query select thêm `reminder_days`, thay hardcoded weekend check bằng dynamic check |
| `src/features/tenant/schemas/tenant.schema.ts` | Thêm `reminder_days: z.array(z.number().int().min(1).max(7))` vào `teamSettingsSchema` |
| `src/features/tenant/services/tenant.service.ts` | Thêm `reminder_days` vào `TenantSettings` type, `getTenantSettings` SELECT, `updateTenantSettings` destructure+update |
| `src/routes/_app/team/settings.tsx` | Thêm UI: 7 toggle buttons (T2–CN) cho `reminder_days` field |

**KHÔNG cần:**
- RLS policy mới — `tenants_update_policy` đã giới hạn owner/manager
- Edge Function mới — cập nhật inline `notify-schedule-reminder`
- Tạo table mới

---

## DB Schema

```sql
-- Migration: supabase/migrations/20260325000004_add_reminder_days_to_tenants.sql

ALTER TABLE public.tenants
  ADD COLUMN reminder_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}';
-- ISO weekday: 1=Thứ 2, 2=Thứ 3, 3=Thứ 4, 4=Thứ 5, 5=Thứ 6, 6=Thứ 7, 7=Chủ Nhật

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_reminder_days_valid
  CHECK (reminder_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);
-- <@ = "is contained by" — mọi phần tử trong reminder_days phải nằm trong [1..7]
```

---

## Edge Function Update

### TenantRow type (thêm `reminder_days`)

```typescript
type TenantRow = {
  id: string
  name: string
  timezone: string
  schedule_deadline_day: number
  schedule_deadline_hour: number
  reminder_days: number[]   // ← THÊM MỚI
}
```

### Query select (thêm `reminder_days`)

```typescript
const { data: tenants, error: tenantsError } = await supabaseAdmin
  .from('tenants')
  .select('id, name, timezone, reminder_days')  // ← thêm reminder_days
```

### Thay hardcoded weekend check bằng dynamic check

```typescript
// BEFORE (hardcoded T7/CN):
if (isoWeekday === 6 || isoWeekday === 7) { continue }

// AFTER (per-tenant config):
const reminderDays: number[] = tenant.reminder_days ?? [1, 2, 3, 4, 5]
if (!reminderDays.includes(isoWeekday)) {
  console.log(`[daily_report_reminder] day ${isoWeekday} not in reminder_days tenant=${tenant.id}, skipping`)
  continue
}
```

---

## Frontend Schema (tenant.schema.ts)

```typescript
// Thêm vào teamSettingsSchema:
reminder_days: z
  .array(z.number().int().min(1).max(7))
  .min(0)   // cho phép array rỗng (tắt hoàn toàn)
  .max(7),
```

---

## Frontend Service (tenant.service.ts)

```typescript
// TenantSettings type — thêm field:
reminder_days: number[]

// getTenantSettings — thêm vào SELECT string:
'...default_committed_hours, reminder_days'

// updateTenantSettings — destructure + update:
const { ..., reminder_days } = settings
// Trong .update({ ... }): thêm reminder_days
```

---

## Frontend UI (settings.tsx)

### Constants

```typescript
// ISO weekday labels (1=Mon…7=Sun) — thêm mới bên cạnh DAYS_OF_WEEK hiện có
const REMINDER_DAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 7, label: 'CN' },
]
```

### Form defaultValues — thêm:

```typescript
reminder_days: [1, 2, 3, 4, 5],
```

### Form values mapping — thêm:

```typescript
reminder_days: settings.reminder_days,
```

### UI component (thêm FormField mới sau `daily_report_deadline_hour`):

```tsx
<FormField
  control={form.control}
  name='reminder_days'
  render={({ field }) => (
    <FormItem>
      <FormLabel>Ngày gửi nhắc nhở daily report</FormLabel>
      <FormDescription>
        Chọn các ngày trong tuần sẽ gửi reminder. Bỏ chọn hết = tắt reminder.
      </FormDescription>
      <FormControl>
        <div className='flex gap-2 flex-wrap'>
          {REMINDER_DAYS.map((day) => {
            const active = field.value?.includes(day.value)
            return (
              <button
                key={day.value}
                type='button'
                onClick={() => {
                  const current = field.value ?? []
                  field.onChange(
                    active
                      ? current.filter((d) => d !== day.value)
                      : [...current, day.value].sort((a, b) => a - b)
                  )
                }}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {day.label}
              </button>
            )
          })}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Testing Checklist

```bash
# 1. Apply migration
npx supabase db push --local

# 2. Verify column tồn tại
# SELECT reminder_days FROM tenants LIMIT 1;
# Expected: {1,2,3,4,5}

# 3. supabase test db vẫn pass
npx supabase test db

# 4. Test Edge Function với tenant có reminder_days = {1,2,3,4,5}
# Chạy vào ngày T7 (isoWeekday=6) → reminded_count=0
# Chạy vào ngày T2–T6 → reminded_count=N

# 5. UI: toggle ngày, save → verify DB updated
# SELECT reminder_days FROM tenants WHERE id = '<tenant_id>';
```

---

## Change Log

- 2026-03-25: Story created — per-tenant reminder days config cho daily_report_reminder
- 2026-03-25: Implement — migration + Edge Function + schema + service + UI; 63/63 tests PASS
