# Story 5.1: Committed Hours Configuration

**Status:** review
**Epic:** 5 — Hours Analytics
**Story ID:** 5.1
**Story Key:** 5-1-committed-hours-configuration
**Created:** 2026-03-25
**Updated:** 2026-03-25

---

## Story

As a Manager or Owner,
I want to set committed hours targets for each team member,
So that the system can track and measure each person's commitment accurately.

---

## Acceptance Criteria

1. **Set per-member committed hours** — Manager/Owner có thể set `committed_hours` target cho từng member (VD: 35h/tuần). Giá trị được lưu vào `tenant_members.committed_hours`.

2. **Per-member override team default** — Khi analytics calculate commitment rate, nếu member có `committed_hours != null` → dùng per-member value. Nếu `null` → fallback về `tenants.default_committed_hours`.

3. **Immediate effect** — Thay đổi committed hours có hiệu lực ngay lập tức (không cần approve).

4. **Analytics placeholder route** — Tạo route `/analytics` placeholder (hiện chưa tồn tại → 404 hiện tại). Sidebar link đã có, route phải tồn tại.

5. **Permission gate** — Chỉ Manager/Owner thấy UI để edit committed_hours. Member chỉ read-only.

---

## Tasks / Subtasks

### ⚠️ KHÔNG CẦN MIGRATION — Columns đã tồn tại

**MCP đã xác nhận:**
- `tenant_members.committed_hours` — `smallint`, nullable ✅ (đã có từ Epic 1)
- `tenants.default_committed_hours` — `smallint`, NOT NULL, default `40` ✅ (đã có từ Epic 1)

**KHÔNG tạo migration mới cho 2 columns này.**

---

### Task 1: Thêm `updateMemberCommittedHours` vào tenant.service.ts ✅

File: `src/features/tenant/services/tenant.service.ts`

```typescript
export const updateMemberCommittedHours = async (
  memberId: string,
  committedHours: number | null
): Promise<void> => {
  // P-02: chain .select('id') để detect silent RLS-blocked update
  const { data, error } = await supabase
    .from('tenant_members')
    .update({ committed_hours: committedHours })
    .eq('id', memberId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update returned no rows — check RLS policies')
}
```

**Lưu ý:**
- Dùng `memberId` (PK `id` của tenant_members) — không phải `user_id`
- `committedHours: number | null` — `null` = reset về team default
- RLS UPDATE policy trên `tenant_members` dùng `is_tenant_manager()` — chỉ owner/manager có thể update ✅

---

### Task 2: Tạo hook `use-update-member-committed-hours.ts` ✅

File: `src/features/tenant/hooks/use-update-member-committed-hours.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { updateMemberCommittedHours } from '@/features/tenant/services/tenant.service'

export function useUpdateMemberCommittedHours() {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, committedHours }: { memberId: string; committedHours: number | null }) =>
      updateMemberCommittedHours(memberId, committedHours),
    onSuccess: () => {
      toast.success('Đã cập nhật giờ cam kết')
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
      })
    },
    onError: () => {
      toast.error('Không thể cập nhật giờ cam kết. Vui lòng thử lại.')
    },
  })
}
```

---

### Task 3: Tạo `SetCommittedHoursDialog.tsx` ✅

File: `src/features/tenant/components/SetCommittedHoursDialog.tsx`

**Pattern:** Giống `PromoteMemberDialog.tsx` / `DemoteMemberDialog.tsx` (dialog + form + mutation).

```typescript
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Clock } from 'lucide-react'
import { useUpdateMemberCommittedHours } from '@/features/tenant/hooks/use-update-member-committed-hours'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormDescription,
  FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const committedHoursSchema = z.object({
  committedHours: z
    .number({ invalid_type_error: 'Vui lòng nhập số' })
    .int()
    .min(1, 'Tối thiểu 1 giờ')
    .max(168, 'Tối đa 168 giờ')
    .nullable(),
})
type CommittedHoursInput = z.infer<typeof committedHoursSchema>

interface SetCommittedHoursDialogProps {
  memberId: string
  memberName: string
  currentCommittedHours: number | null
  defaultCommittedHours: number  // từ tenant settings — để hiển thị placeholder
}

export function SetCommittedHoursDialog({
  memberId,
  memberName,
  currentCommittedHours,
  defaultCommittedHours,
}: SetCommittedHoursDialogProps) {
  const [open, setOpen] = useState(false)
  const mutation = useUpdateMemberCommittedHours()

  const form = useForm<CommittedHoursInput>({
    resolver: zodResolver(committedHoursSchema),
    defaultValues: { committedHours: currentCommittedHours },
  })

  const handleSubmit = (data: CommittedHoursInput) => {
    mutation.mutate(
      { memberId, committedHours: data.committedHours },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon' title='Chỉnh sửa giờ cam kết'>
          <Clock className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giờ cam kết — {memberName}</DialogTitle>
          <DialogDescription>
            Số giờ làm việc cam kết mỗi tuần. Mặc định nhóm: {defaultCommittedHours}h/tuần.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='committedHours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ cam kết / tuần</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={168}
                      placeholder={`Mặc định nhóm: ${defaultCommittedHours}h`}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))
                      }
                    />
                  </FormControl>
                  <FormDescription>Để trống để dùng mặc định nhóm ({defaultCommittedHours}h/tuần)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task 4: Cập nhật `MemberList.tsx` ✅

File: `src/features/tenant/components/MemberList.tsx`

**Thay đổi cần thiết:**
- Nhận thêm prop `defaultCommittedHours: number` từ parent (từ tenant settings)
- Hiển thị committed_hours mỗi member trong row
- Thêm `SetCommittedHoursDialog` trigger khi `canManage`

**Thông tin UI trong member row (thêm vào phần right-side hiện tại):**

```tsx
// Thêm vào right side của member row, trước Badge role
{canManage && (
  <SetCommittedHoursDialog
    memberId={member.id}
    memberName={member.users.full_name || member.users.email?.split('@')[0] || 'Member'}
    currentCommittedHours={member.committed_hours}
    defaultCommittedHours={defaultCommittedHours}
  />
)}
// Hiện giờ cam kết trong sub-text của member info (read-only cho tất cả)
// Thêm vào phần <div> chứa full_name và email:
<p className='text-muted-foreground text-xs'>
  {member.committed_hours != null
    ? `${member.committed_hours}h/tuần (riêng)`
    : `${defaultCommittedHours}h/tuần (mặc định nhóm)`}
</p>
```

**Thay đổi prop interface:**
```typescript
interface MemberListProps {
  canManage: boolean
  currentUserId: string
  defaultCommittedHours: number  // thêm mới
}
```

---

### Task 5: Cập nhật `team/members.tsx` route ✅

File: `src/routes/_app/team/members.tsx`

Fetch `tenantSettings` để lấy `default_committed_hours`, pass vào `MemberList`:

```typescript
// Thêm query để fetch tenant settings
const { data: settings } = useQuery({
  queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
  queryFn: () => {
    if (!activeTenantId) throw new Error('No active tenant')
    return getTenantSettings(activeTenantId)
  },
  enabled: !!activeTenantId,
})

// Pass vào MemberList:
<MemberList
  canManage={canManage}
  currentUserId={user.id}
  defaultCommittedHours={settings?.default_committed_hours ?? 40}
/>
```

---

### Task 6: Tạo analytics route placeholder ✅

File: `src/routes/_app/analytics.tsx`

**Tại sao cần:** Sidebar đã có link `/analytics` (BarChart3 icon) nhưng route chưa tồn tại → 404. Story này tạo placeholder để không bị lỗi navigation.

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'

export const Route = createFileRoute('/_app/analytics')({
  head: () => ({
    meta: [{ title: 'Analytics — TekSpace' }],
  }),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  return (
    <div className='flex flex-col items-center justify-center py-24 text-center'>
      <BarChart3 className='text-muted-foreground mb-4 h-12 w-12' />
      <h1 className='text-2xl font-semibold'>Analytics</h1>
      <p className='text-muted-foreground mt-2 text-sm'>
        Tính năng đang được phát triển. Sẽ sớm ra mắt.
      </p>
    </div>
  )
}
```

---

### Task 7: Viết pgTAP test ✅

File: `supabase/tests/` — thêm test case vào test file phù hợp (hoặc tạo `20260325_committed_hours_rls.sql` nếu chưa có)

**Test RLS UPDATE policy trên `tenant_members.committed_hours`:**

```sql
-- Test 1: Manager có thể UPDATE committed_hours
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{
  "sub": "<manager_user_id>",
  "role": "authenticated",
  "active_tenant_id": "<tenant_id>"
}';
-- Thực hiện UPDATE và verify không có error
-- SELECT committed_hours FROM tenant_members WHERE id = '<member_id>';
ROLLBACK;

-- Test 2: Member KHÔNG thể UPDATE committed_hours
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{
  "sub": "<member_user_id>",
  "role": "authenticated",
  "active_tenant_id": "<tenant_id>"
}';
-- UPDATE phải bị block (return empty rows)
ROLLBACK;
```

---

## Architecture & Pattern Compliance

### Service Layer Pattern (PHẢI tuân theo)

```
MemberList component
      ↓
useUpdateMemberCommittedHours() hook  ← React Query useMutation
      ↓
updateMemberCommittedHours() service  ← Supabase client call
      ↓
tenant_members table (RLS enforced)
```

- **KHÔNG** gọi service trực tiếp từ component
- **KHÔNG** tạo Supabase client mới — `import { supabase } from '@/lib/supabase-browser'`
- **KHÔNG** barrel exports — import trực tiếp từ file

### RLS Facts (đã verify qua MCP)

| Policy | Condition |
|--------|-----------|
| `tenant_members_update_policy` | `is_tenant_manager()` — chỉ owner/manager |
| `tenant_members_select_policy` | `tenant_id = current_tenant_id() OR user_id = auth.uid()` |

→ RLS đã đúng. Member không thể tự UPDATE committed_hours. Không cần thêm policy.

### Naming Conventions

- Service: `updateMemberCommittedHours` (camelCase, verb-first)
- Hook: `use-update-member-committed-hours.ts` (kebab-case file, `useUpdateMemberCommittedHours` export)
- Component: `SetCommittedHoursDialog.tsx` (PascalCase)
- Query key: dùng `QUERY_KEYS.tenantMembers` (đã có, invalidate sau mutation)
- Schema: `committedHoursSchema` (camelCase + Schema suffix)

### Existing Constants — PHẢI dùng

```typescript
ROUTES.app.analytics  // '/analytics' ← route mới cần tạo
QUERY_KEYS.tenantMembers  // 'tenant-members'
QUERY_KEYS.tenantSettings // 'tenant-settings'
QUERY_KEYS.analytics  // 'analytics' ← cho story 5.2/5.3
```

---

## DB Schema (verified via MCP)

### `tenant_members` (relevant columns)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | gen_random_uuid() |
| `tenant_id` | uuid | NO | — |
| `user_id` | uuid | NO | — |
| `role` | member_role | NO | 'member' |
| `committed_hours` | **smallint** | **YES** | NULL |
| `updated_at` | timestamptz | NO | now() |

### `tenants` (relevant columns)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `default_committed_hours` | **smallint** | NO | **40** |

### Committed Hours Logic

```
effectiveCommittedHours(member) =
  member.committed_hours ?? tenant.default_committed_hours
```

→ Đây là logic dùng cho Stories 5.2 và 5.3. Story này CHỈ xử lý việc SET giá trị.

---

## Existing Code to Reuse

### `getMembers()` đã trả về `committed_hours`

```typescript
// tenant.service.ts — đã có, KHÔNG cần thay đổi
export const getMembers = async (tenantId: string): Promise<TenantMemberWithUser[]> => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('id, user_id, role, status, committed_hours, users(id, full_name, avatar_url, timezone, email)')
    ...
}

export type TenantMemberWithUser = {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'member'
  status: 'active' | 'inactive'
  committed_hours: number | null  // ← đã có trong type
  users: { ... }
}
```

### `useTenantMembers()` — hook đã có

```typescript
// src/features/tenant/hooks/use-tenant-members.ts — KHÔNG thay đổi
```

Sau khi mutation thành công → `invalidateQueries([QUERY_KEYS.tenantMembers, activeTenantId])` → tự refetch.

### `getTenantSettings()` — service đã có, trả về `default_committed_hours`

```typescript
// tenant.service.ts — đã có
export const getTenantSettings = async (tenantId): Promise<TenantSettings> => { ... }
// TenantSettings đã có: default_committed_hours: number
```

---

## Files to Create / Modify

### Tạo mới

| File | Purpose |
|------|---------|
| `src/features/tenant/hooks/use-update-member-committed-hours.ts` | useMutation hook |
| `src/features/tenant/components/SetCommittedHoursDialog.tsx` | Dialog component |
| `src/routes/_app/analytics.tsx` | Analytics placeholder route |

### Chỉnh sửa

| File | Thay đổi |
|------|---------|
| `src/features/tenant/services/tenant.service.ts` | Thêm `updateMemberCommittedHours()` |
| `src/features/tenant/components/MemberList.tsx` | Thêm prop `defaultCommittedHours`, hiển thị committed_hours, trigger dialog |
| `src/routes/_app/team/members.tsx` | Fetch tenant settings, pass `defaultCommittedHours` vào `MemberList` |

### KHÔNG cần chỉnh sửa

| File | Lý do |
|------|-------|
| `supabase/migrations/` | Columns đã tồn tại |
| `src/lib/query-keys.ts` | `QUERY_KEYS.tenantMembers` và `analytics` đã có |
| `src/lib/routes.ts` | `ROUTES.app.analytics` đã có |
| `src/components/layout/data/sidebar-data.ts` | Link `/analytics` đã có |
| `src/lib/supabase-types.ts` | Column đã có từ trước → types đã generated |

---

## Anti-Pattern Prevention

| ❌ ĐỪNG làm | ✅ NÊN làm |
|------------|-----------|
| Tạo migration cho `committed_hours` | Column đã tồn tại — skip migration |
| Tạo Supabase client mới trong service | `import { supabase } from '@/lib/supabase-browser'` |
| Gọi service trực tiếp từ component | Qua hook (useUpdateMemberCommittedHours) |
| Hardcode query key string | `QUERY_KEYS.tenantMembers` |
| Tạo `index.ts` barrel export | Import trực tiếp từ file |
| Check role bằng `role === 'manager'` trong component | `usePermissions().canManageMembers` |
| UPDATE dựa trên `user_id` | UPDATE dựa trên `id` (PK của tenant_members) |
| Để analytics link là 404 | Tạo route placeholder `/analytics` |

---

## Git Context (Recent Commits)

```
17883d7 feat(story-6-2): notify-schedule-reminder Edge Function
32cf6aa feat(3-1): team overview dashboard + code review fixes
28bd46c feat(schedule): story 2-5 — UX polish & 3-tier lock model
30249cb feat(4-5): per-task hours with code review fixes
7a30264 feat(6-1): in-app notification center with realtime badge
```

**Patterns từ recent work:**
- Dialog components tuân theo `useState(false)` + `onSuccess: () => setOpen(false)` pattern
- Mutations luôn invalidate queryKey sau onSuccess
- `toast.success()` / `toast.error()` via sonner
- `feat(story-X-Y):` commit format

---

## Testing Requirements

### pgTAP Test (`npx supabase test db`)

Test tối thiểu (2 tầng):

1. **Owner/Manager CAN update `committed_hours`** — verify UPDATE không bị block
2. **Member CANNOT update `committed_hours`** — verify UPDATE bị block (0 rows affected)

### Manual Test

1. Login là Manager → Team Members page → Clock icon hiện → click → dialog mở → nhập 30 → Lưu → member row hiển thị "30h/tuần (riêng)"
2. Login là Member → Members page → Clock icon KHÔNG hiện
3. Set committed_hours = null (xóa) → display về "40h/tuần (mặc định nhóm)" (hoặc team default)
4. Navigate đến `/analytics` → không 404, hiện placeholder page

---

## Notes / Questions

- **Scope**: Story này chỉ set/display committed_hours trong Member List. Analytics calculations dùng giá trị này sẽ ở Story 5.2 và 5.3.
- **Owner committed_hours**: Owner cũng có `tenant_members` record → cũng có thể set committed_hours → UI nên hiện button cho tất cả members (kể cả owner).
- **Validation**: 1–168 giờ/tuần (max 7×24=168). Match pattern của `team/settings.tsx`.

---

## Dev Agent Record

### Implementation Notes

- **Không cần migration** — columns `tenant_members.committed_hours` (smallint, nullable) và `tenants.default_committed_hours` (smallint, default 40) đã tồn tại từ Epic 1, verify qua MCP.
- **members.tsx đã có** `getTenantSettings` query với `staleTime: 5 * 60 * 1000` — chỉ thêm pass prop `defaultCommittedHours` vào `MemberList`.
- **Dialog pattern** tuân theo `useState(false)` + `form.reset()` khi mở + `onSuccess: () => setOpen(false)` — consistent với các dialog hiện có.
- **pgTAP tests** thêm 2 test cases (22 + 23) vào file `rls_policies.test.sql` hiện có, plan count tăng từ 21 → 23. Cần thêm helper function `_test_update_committed_hours`.

### Completion Notes

✅ AC1: `updateMemberCommittedHours()` service + `useUpdateMemberCommittedHours()` hook + `SetCommittedHoursDialog` — Manager/Owner có thể set committed_hours per member.
✅ AC2: `effectiveCommittedHours = member.committed_hours ?? defaultCommittedHours` — logic display đúng trong MemberList.
✅ AC3: Mutation invalidate `tenantMembers` query key → UI refresh ngay lập tức.
✅ AC4: Analytics placeholder route tạo tại `/analytics` — không còn 404.
✅ AC5: `SetCommittedHoursDialog` chỉ render khi `canManage === true` — member không thấy Clock button.
✅ pgTAP: 62 tests pass (23 trong rls_policies.test.sql + các test file khác).
✅ TypeScript: `tsc --noEmit` không có lỗi.
✅ Lint: 0 errors, 1 warning cũ (pre-existing trong SlotForm.tsx).

---

## File List

### Tạo mới
- `src/features/tenant/hooks/use-update-member-committed-hours.ts`
- `src/features/tenant/components/SetCommittedHoursDialog.tsx`
- `src/routes/_app/analytics.tsx`

### Chỉnh sửa
- `src/features/tenant/services/tenant.service.ts` — thêm `updateMemberCommittedHours()`
- `src/features/tenant/components/MemberList.tsx` — thêm prop `defaultCommittedHours`, hiển thị committed hours, thêm `SetCommittedHoursDialog`
- `src/routes/_app/team/members.tsx` — pass `defaultCommittedHours` vào `MemberList`
- `supabase/tests/rls_policies.test.sql` — thêm helper `_test_update_committed_hours` + 2 test cases (22, 23), plan 21→23

---

## Change Log

- **2026-03-25** — Story 5.1 implemented: committed hours configuration + analytics placeholder route (Story key: 5-1-committed-hours-configuration)
