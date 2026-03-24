# Story 1.4: Tenant Creation & Team Settings

Status: done

## Story

As an Owner,
I want to create a new team workspace and configure its settings,
So that my team has a properly configured environment before members join.

## Acceptance Criteria

1. **Tạo tenant** — User chưa có tenant membership nào → redirect đến `/create-tenant` → điền team name → submit → tenant được INSERT vào DB, DB trigger `handle_new_tenant()` tự INSERT creator làm owner vào `tenant_members` → gọi `supabase.auth.refreshSession()` để JWT mới có `tenant_roles` → init tenant store → redirect đến `/settings/team` để hoàn tất setup.

2. **Team settings page** — Owner truy cập `/settings/team` → form load settings hiện tại từ `tenants` table → Owner cấu hình: team timezone, schedule submission deadline (ngày + giờ), daily report deadline (giờ), default committed hours → save → toast.success.

3. **Daily report deadline default** — Khi tạo tenant mới, `daily_report_deadline_hour` mặc định = 3 (03:00 sáng ngày hôm sau theo team timezone) — đây là DB default, không cần set thủ công.

4. **Timezone change** — Khi Owner thay đổi team timezone và save → settings được lưu, UTC storage không thay đổi, timestamp displays trong app reflect timezone mới (future stories).

5. **Permission guard** — Chỉ Owner (role = `owner`, permission = `manageTenant`) mới thấy và sử dụng form team settings. Non-owner thấy message "Chỉ Owner mới có thể thay đổi cài đặt nhóm." (read-only view).

6. **App Layout** — Thay thế stub trong `_app/route.tsx` bằng `AuthenticatedLayout` thực sự. Guard session + tenant redirect: nếu không có `activeTenantId` VÀ không đang ở `/create-tenant` → redirect đến `/create-tenant`.

7. **Form validation** — Tất cả inputs được validate bằng Zod trước khi call API. Lỗi field-level là inline, lỗi server là `toast.error()`.

## Tasks / Subtasks

- [x] Task 1: Tạo Tenant Service (AC: 1, 2, 4)
  - [x] Tạo `src/features/tenant/services/tenant.service.ts`
  - [x] `createTenant(name: string)` → INSERT tenants → refreshSession → return { tenantId, session }
  - [x] `getTenantSettings(tenantId: string)` → SELECT từ tenants WHERE id = tenantId
  - [x] `updateTenantSettings(tenantId, settings)` → UPDATE tenants SET ...

- [x] Task 2: Tạo Tenant Schema (AC: 1, 2, 7)
  - [x] Tạo `src/features/tenant/schemas/tenant.schema.ts`
  - [x] `createTenantSchema`: name (string, min 2, max 100, trim)
  - [x] `teamSettingsSchema`: timezone, schedule_deadline_day (0-6), schedule_deadline_hour (0-23), daily_report_deadline_hour (0-23), default_committed_hours (1-168)

- [x] Task 3: Cập nhật App Layout (AC: 6)
  - [x] Sửa `src/routes/_app/route.tsx`
  - [x] Thay stub bằng `<AuthenticatedLayout />` (import từ `@/components/layout/authenticated-layout`)
  - [x] Giữ nguyên session guard (beforeLoad)
  - [x] Thêm tenant redirect: không có activeTenantId + không phải `/create-tenant` → redirect `/create-tenant`

- [x] Task 4: Implement Create Tenant Page (AC: 1)
  - [x] Sửa `src/routes/_app/create-tenant.tsx`
  - [x] Thay placeholder bằng form thực sự sử dụng `createTenantSchema`
  - [x] Submit flow: createTenant() → refreshSession → initFromSession → setActiveTenant → navigate `/settings/team`

- [x] Task 5: Implement Team Settings Page (AC: 2, 3, 4, 5, 7)
  - [x] Sửa `src/routes/_app/settings/team.tsx`
  - [x] Load settings với `useQuery` (key: `['tenant-settings', activeTenantId]`)
  - [x] Form với 5 fields: timezone, schedule_deadline_day, schedule_deadline_hour, daily_report_deadline_hour, default_committed_hours
  - [x] Permission check: activeRole === 'owner' → show form; else → show read-only message
  - [x] Submit: `updateTenantSettings()` → `toast.success('Đã lưu cài đặt nhóm')`
  - [x] Invalidate query sau khi update thành công

- [x] Task 6: Cập nhật QUERY_KEYS (AC: 2)
  - [x] Thêm `tenantSettings: 'tenant-settings'` vào `src/lib/query-keys.ts`

## Dev Notes

### Foundation từ Các Story Trước — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | **CHỈ dùng cái này**, KHÔNG createClient() thêm |
| `src/stores/auth-store.ts` | ✅ có user, session, signIn | Import `useAuthStore` |
| `src/stores/tenant-store.ts` | ✅ có initFromSession, setActiveTenant | Import `useTenantStore` |
| `src/lib/permissions.ts` | ✅ có MemberRole, hasPermission | `manageTenant` permission = Owner only |
| `src/lib/routes.ts` | ✅ có `app.createTenant`, `app.settings.team` | Dùng ROUTES.*, không hardcode |
| `src/lib/query-keys.ts` | ✅ có tenantMembers, v.v. | **THÊM** `tenantSettings` key |
| `src/components/layout/authenticated-layout.tsx` | ✅ có sẵn với AppSidebar | Dùng ngay trong _app/route.tsx |
| `src/features/auth/services/auth.service.ts` | ✅ có `initTenantAndGetRoute` | Pattern tham chiếu — không tái tạo |
| `src/routes/_app/create-tenant.tsx` | ✅ placeholder | **THAY THẾ** bằng form thực sự |
| `src/routes/_app/settings/team.tsx` | ✅ placeholder | **THAY THẾ** bằng settings form thực sự |

### Database Schema — BẮT BUỘC NẮM RÕ

**`public.tenants` table:**
```sql
id                          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name                        text NOT NULL
timezone                    text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
schedule_deadline_day       smallint NOT NULL DEFAULT 0   -- 0=Sunday, 1=Monday ... 6=Saturday
schedule_deadline_hour      smallint NOT NULL DEFAULT 23  -- 0-23
daily_report_deadline_hour  smallint NOT NULL DEFAULT 3   -- 0-23, 3 = 03:00 sáng
default_committed_hours     smallint NOT NULL DEFAULT 40  -- 1-168
created_at                  timestamptz NOT NULL DEFAULT now()
updated_at                  timestamptz NOT NULL DEFAULT now()
```

**RLS Policies cho `tenants`:**
- `tenants_insert_policy`: bất kỳ authenticated user nào cũng INSERT được
- `tenants_update_policy`: chỉ owner hoặc manager của tenant đó mới UPDATE được
- `tenants_select_policy`: chỉ active members của tenant mới SELECT được
- **Trigger `on_tenant_created`**: sau khi INSERT tenant → tự INSERT creator vào `tenant_members` với role='owner', status='active' (SECURITY DEFINER — không cần service role)

### Tenant Service — Implementation Pattern

```typescript
// src/features/tenant/services/tenant.service.ts
import { supabase } from '@/lib/supabase-browser'

export const createTenant = async (name: string) => {
  // 1. Insert tenant (trigger tự tạo owner membership)
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ name })
    .select('id, name')
    .single()
  if (error) throw error

  // 2. Refresh session để JWT mới có tenant_roles
  // QUAN TRỌNG: Phải gọi refreshSession() để custom_access_token_hook
  // embed tenant_roles mới vào JWT. Thiếu bước này → tenant store sẽ
  // không có tenant, app redirect loop về /create-tenant.
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) throw refreshError

  return { tenant, session: refreshData.session }
}

export const getTenantSettings = async (tenantId: string) => {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, timezone, schedule_deadline_day, schedule_deadline_hour, daily_report_deadline_hour, default_committed_hours')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data
}

export const updateTenantSettings = async (
  tenantId: string,
  settings: {
    timezone: string
    schedule_deadline_day: number
    schedule_deadline_hour: number
    daily_report_deadline_hour: number
    default_committed_hours: number
  }
) => {
  const { error } = await supabase
    .from('tenants')
    .update(settings)
    .eq('id', tenantId)
  if (error) throw error
}
```

### Create Tenant Flow — Luồng Quan Trọng

```
1. User submit form với team name
2. createTenant(name) → INSERT tenants (RLS: any auth user)
   → DB trigger handle_new_tenant() tự INSERT tenant_members (SECURITY DEFINER)
   → refreshSession() → Supabase gọi lại custom_access_token_hook
   → hook đọc tenant_members mới → embed { [newTenantId]: 'owner' } vào tenant_roles
   → trả về session mới với JWT updated
3. useTenantStore.getState().initFromSession(newSession.access_token)
   → parse JWT → set tenants = [{ tenantId: newId, role: 'owner' }]
4. useTenantStore.getState().setActiveTenant(newTenantId)
   → set activeTenantId + activeRole, lưu vào localStorage
5. navigate({ to: ROUTES.app.settings.team })
```

### Create Tenant Page Pattern

```typescript
// src/routes/_app/create-tenant.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
import { createTenantSchema, type CreateTenantInput } from '@/features/tenant/schemas/tenant.schema'
import { createTenant } from '@/features/tenant/services/tenant.service'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'
// ... Card, Form, FormField, Input, Button imports

export const Route = createFileRoute('/_app/create-tenant')({
  component: CreateTenantPage,
})

function CreateTenantPage() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  const form = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: '' },
  })

  const onSubmit = async (data: CreateTenantInput) => {
    setIsPending(true)
    try {
      const { tenant, session } = await createTenant(data.name)
      if (session) {
        const tenantStore = useTenantStore.getState()
        tenantStore.initFromSession(session.access_token)
        tenantStore.setActiveTenant(tenant.id)
      }
      await navigate({ to: ROUTES.app.settings.team })
    } catch {
      toast.error('Không thể tạo team. Vui lòng thử lại.')
    } finally {
      setIsPending(false)
    }
  }
  // Render card layout với form
}
```

### Team Settings Page Pattern

```typescript
// src/routes/_app/settings/team.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { teamSettingsSchema, type TeamSettingsInput } from '@/features/tenant/schemas/tenant.schema'
import { getTenantSettings, updateTenantSettings } from '@/features/tenant/services/tenant.service'

export const Route = createFileRoute('/_app/settings/team')({
  component: TeamSettingsPage,
})

function TeamSettingsPage() {
  const { activeTenantId, activeRole } = useTenantStore()
  const queryClient = useQueryClient()
  const isOwner = activeRole === 'owner'

  const { data: settings, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => getTenantSettings(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const form = useForm<TeamSettingsInput>({
    resolver: zodResolver(teamSettingsSchema),
  })

  // Populate form sau khi data load xong
  useEffect(() => {
    if (settings) {
      form.reset({
        timezone: settings.timezone,
        schedule_deadline_day: settings.schedule_deadline_day,
        schedule_deadline_hour: settings.schedule_deadline_hour,
        daily_report_deadline_hour: settings.daily_report_deadline_hour,
        default_committed_hours: settings.default_committed_hours,
      })
    }
  }, [settings, form])

  const mutation = useMutation({
    mutationFn: (data: TeamSettingsInput) =>
      updateTenantSettings(activeTenantId!, data),
    onSuccess: () => {
      toast.success('Đã lưu cài đặt nhóm')
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
      })
    },
    onError: () => {
      toast.error('Không thể lưu cài đặt. Vui lòng thử lại.')
    },
  })

  if (!isOwner) {
    return (
      <div className='text-muted-foreground py-8 text-center text-sm'>
        Chỉ Owner mới có thể thay đổi cài đặt nhóm.
      </div>
    )
  }

  if (isLoading) return <div>Đang tải...</div>

  return (
    // Form với 5 fields
  )
}
```

### Schema — Tenant Schemas

```typescript
// src/features/tenant/schemas/tenant.schema.ts
import { z } from 'zod'

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Tên nhóm tối thiểu 2 ký tự').max(100, 'Tên nhóm tối đa 100 ký tự').trim(),
})

export const teamSettingsSchema = z.object({
  timezone: z.string().min(1, 'Vui lòng chọn timezone'),
  schedule_deadline_day: z.number().int().min(0).max(6),
  schedule_deadline_hour: z.number().int().min(0).max(23),
  daily_report_deadline_hour: z.number().int().min(0).max(23),
  default_committed_hours: z
    .number()
    .int()
    .min(1, 'Tối thiểu 1 giờ')
    .max(168, 'Tối đa 168 giờ'),
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>
export type TeamSettingsInput = z.infer<typeof teamSettingsSchema>
```

### App Layout Update — _app/route.tsx

```typescript
// src/routes/_app/route.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const {
      data: { session },
      error,
    } = await context.supabase.auth.getSession()

    if (error || !session) {
      throw redirect({ to: ROUTES.signIn })
    }

    // Sync session vào stores
    useAuthStore.getState().setSession(session)
    useTenantStore.getState().initFromSession(session.access_token)

    // Redirect đến create-tenant nếu user chưa có tenant
    // KHÔNG redirect nếu đang ở /create-tenant (tránh infinite loop)
    const { activeTenantId } = useTenantStore.getState()
    if (!activeTenantId && location.pathname !== ROUTES.app.createTenant) {
      throw redirect({ to: ROUTES.app.createTenant })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return <AuthenticatedLayout />
}
```

⚠️ **QUAN TRỌNG — Redirect Logic:**
- `location.pathname !== ROUTES.app.createTenant` check là BẮT BUỘC để tránh infinite redirect loop khi user đang ở create-tenant page
- Lý do: `_app/route.tsx` là parent của `/create-tenant` route, nếu không check → redirect → redirect → loop

### Timezone Selector — Dùng gì?

Không có thư viện timezone picker đặc biệt. Dùng **hardcoded list IANA timezones** phổ biến (hoặc `Intl.supportedValuesOf('timeZone')` nếu browser support). Ưu tiên dùng `Select` từ shadcn:

```typescript
// Danh sách timezones phổ biến cho team work (Southeast Asia + global)
const COMMON_TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Hồ Chí Minh (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (UTC+5:30)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
]
```

Dùng shadcn `Select` component (đã có sẵn trong `src/components/ui/select.tsx`).

### Form Fields UI Reference

| Field | Type | Options/Range | Default |
|-------|------|---------------|---------|
| timezone | Select | IANA timezone list | `Asia/Ho_Chi_Minh` |
| schedule_deadline_day | Select | 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7 | 0 (Sunday) |
| schedule_deadline_hour | Select | 0-23 (hiển thị "00:00" → "23:00") | 23 |
| daily_report_deadline_hour | Select | 0-23 | 3 (hiển thị "03:00") |
| default_committed_hours | Input number | min=1, max=168, step=1 | 40 |

**Lưu ý:** Các Select cho hour nên hiển thị dạng "HH:00" (ví dụ 3 → "03:00", 23 → "23:00") để người dùng dễ hiểu.

**Lưu ý về `default_committed_hours`:** Đây là default cho member mới. Mỗi `tenant_members` row có column `committed_hours` (nullable) — nếu null thì dùng tenant default. Story 1.6 sẽ implement per-member override.

### Error Messages (UX)

| Tình huống | Loại | Message |
|---|---|---|
| Team name < 2 ký tự | Inline Zod | `"Tên nhóm tối thiểu 2 ký tự"` |
| Team name > 100 ký tự | Inline Zod | `"Tên nhóm tối đa 100 ký tự"` |
| Tạo tenant thất bại | Toast error | `"Không thể tạo team. Vui lòng thử lại."` |
| Lưu settings thành công | Toast success | `"Đã lưu cài đặt nhóm"` |
| Lưu settings thất bại | Toast error | `"Không thể lưu cài đặt. Vui lòng thử lại."` |
| Non-owner xem team settings | Inline message | `"Chỉ Owner mới có thể thay đổi cài đặt nhóm."` |

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG tạo thêm `createClient()` | Dùng `src/lib/supabase-browser.ts` singleton |
| ❌ KHÔNG barrel exports | Import trực tiếp từ file |
| ❌ KHÔNG hardcode paths | Dùng `ROUTES.*` constant |
| ❌ KHÔNG dùng toast khác | Chỉ `toast` từ `sonner` |
| ❌ KHÔNG `export default` | Dùng named exports |
| ❌ KHÔNG optimistic updates | `isPending` state hoặc `mutation.isPending` |
| ❌ KHÔNG dùng `clsx`/`twMerge` trực tiếp | Dùng `cn()` từ `@/lib/utils` |
| ❌ KHÔNG dùng service role key client-side | Service role chỉ dùng trong Edge Functions |
| ✅ SAU KHI tạo tenant → PHẢI gọi `refreshSession()` | JWT cần update để có tenant_roles mới |
| ✅ Dùng `AuthenticatedLayout` từ components/layout | Không reinvent layout |

### Project Structure — Files cần tạo/sửa

```
src/
├── features/tenant/               ← TẠO MỚI folder này
│   ├── services/
│   │   └── tenant.service.ts      ← TẠO MỚI
│   └── schemas/
│       └── tenant.schema.ts       ← TẠO MỚI
├── routes/
│   └── _app/
│       ├── route.tsx              ← SỬA (thêm AuthenticatedLayout + tenant redirect)
│       ├── create-tenant.tsx      ← SỬA (thay placeholder bằng form thực sự)
│       └── settings/
│           └── team.tsx           ← SỬA (thay placeholder bằng settings form)
└── lib/
    └── query-keys.ts              ← SỬA (thêm tenantSettings key)
```

### Learnings từ Story 1.3 — Vẫn áp dụng

- `@hookform/resolvers v5.2.2` auto-detects Zod v4 — KHÔNG dùng `/zod/v4` import path
- `ROUTES` có nested structure — dùng `ROUTES.app.settings.team` (KHÔNG phải `ROUTES.settings.team`)
- `useNavigate()` từ `@tanstack/react-router` cho navigation trong component
- `Link` component từ `@tanstack/react-router` cho static links
- `context.supabase` chỉ có trong `beforeLoad` — trong component/service, dùng `supabase` singleton trực tiếp
- 2 pre-existing ESLint errors từ Story 1.1 (`__root.tsx` duplicate import, `supabase/functions`) — không thuộc scope
- `settings/route.tsx` dùng `useRouterState` để detect active tab — pattern đã có, không thay đổi

### Lưu ý TanStack Query

- `useQuery` cho `getTenantSettings`: key = `[QUERY_KEYS.tenantSettings, activeTenantId]`
- `enabled: !!activeTenantId` — không fetch nếu không có tenant context
- `useMutation` pattern: mutationFn → onSuccess (toast + invalidate) → onError (toast)
- `queryClient.invalidateQueries` sau update để sync lại form data

### Không có usePermissions hook (chưa implement)

Architecture đề cập `usePermissions()` hook nhưng chưa được implement (không có file trong hooks/). Đối với Story 1.4, kiểm tra permission trực tiếp:

```typescript
// Đơn giản, đủ dùng cho Story 1.4:
const { activeRole } = useTenantStore()
const isOwner = activeRole === 'owner'
```

Không cần import từ `permissions.ts` cho check đơn giản này. `hasPermission` sẽ được dùng khi implement `<Can>` component/usePermissions hook trong stories sau.

### Thứ tự Implementation được khuyến nghị

1. **Task 6 trước** (query-keys) — avoid type errors khi dùng trong hook
2. **Task 2** (schemas) — foundation cho form
3. **Task 1** (service) — logic layer
4. **Task 3** (_app/route.tsx) — layout cần hoàn thiện trước khi test các pages
5. **Task 4** (create-tenant page) — flow chính
6. **Task 5** (team settings page) — form phức tạp nhất

### References

- FR6: `epics.md` — Tạo tenant mới, owner assignment
- FR7: `epics.md` — Cấu hình team settings
- NFR9: `prd.md` — Tenant data isolation (RLS đã handle ở DB level)
- DB Schema: `supabase/migrations/20260323000002_create_tenants.sql`
- Tenant Members Schema: `supabase/migrations/20260323000003_create_tenant_members.sql`
- RLS Policies: `supabase/migrations/20260323000011_rls_policies.sql` (handle_new_tenant trigger)
- JWT Hook: `supabase/migrations/20260323000012_custom_access_token_hook.sql`
- Auth service patterns: `src/features/auth/services/auth.service.ts` (initTenantAndGetRoute)
- Tenant store: `src/stores/tenant-store.ts`
- Permissions: `src/lib/permissions.ts` (manageTenant = owner only)
- Existing layout: `src/components/layout/authenticated-layout.tsx`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- Không có blocking issues. TypeScript check và ESLint đều pass ngay lần đầu.
- Lưu ý: 2 pre-existing ESLint errors từ Story 1.1 (`__root.tsx`, `supabase/functions`) vẫn còn — không thuộc scope Story 1.4.

### Completion Notes List

- ✅ Task 6: Thêm `tenantSettings: 'tenant-settings'` vào `src/lib/query-keys.ts`
- ✅ Task 2: Tạo mới `src/features/tenant/schemas/tenant.schema.ts` với `createTenantSchema` và `teamSettingsSchema` + TypeScript types
- ✅ Task 1: Tạo mới `src/features/tenant/services/tenant.service.ts` với `createTenant`, `getTenantSettings`, `updateTenantSettings` — dùng singleton supabase-browser, gọi `refreshSession()` sau khi tạo tenant để JWT có tenant_roles
- ✅ Task 3: Sửa `src/routes/_app/route.tsx` — thay stub bằng `<AuthenticatedLayout />`, thêm tenant redirect guard với check `location.pathname !== ROUTES.app.createTenant` để tránh infinite loop
- ✅ Task 4: Sửa `src/routes/_app/create-tenant.tsx` — form đầy đủ với `react-hook-form` + Zod, submit flow: createTenant → initFromSession → setActiveTenant → navigate `/settings/team`
- ✅ Task 5: Sửa `src/routes/_app/settings/team.tsx` — form 5 fields (timezone Select, deadline day Select, 2 deadline hour Select, committed hours Input), permission guard (isOwner check từ activeRole), useQuery + useMutation pattern, invalidate cache sau update

### Implementation Plan

Thứ tự implement: Task 6 → Task 2 → Task 1 → Task 3 → Task 4 → Task 5 (theo khuyến nghị Dev Notes)

Điểm kỹ thuật quan trọng:
- `refreshSession()` sau createTenant là bắt buộc để JWT embed `tenant_roles` mới
- `location.pathname !== ROUTES.app.createTenant` guard trong `beforeLoad` tránh infinite redirect loop
- Hour Select dùng `String(field.value)` / `Number(val)` để bridge string↔number type mismatch của Select component
- Day Select tương tự — shadcn Select value phải là string

### File List

- `src/lib/query-keys.ts` — modified (thêm tenantSettings key)
- `src/features/tenant/schemas/tenant.schema.ts` — created (createTenantSchema, teamSettingsSchema)
- `src/features/tenant/services/tenant.service.ts` — created (createTenant, getTenantSettings, updateTenantSettings)
- `src/routes/_app/route.tsx` — modified (AuthenticatedLayout + tenant redirect)
- `src/routes/_app/create-tenant.tsx` — modified (form thực sự thay placeholder)
- `src/routes/_app/settings/team.tsx` — modified (settings form thay placeholder)

## Change Log

- 2026-03-23: Story 1.4 implemented — Tenant Creation & Team Settings (6 tasks completed)
