# Story 1.7: Tenant Switcher & Personal Profile

Status: review

## Story

As a user,
I want to see which team I'm in and switch between teams easily, and manage my personal timezone,
So that I always work in the right team context and see accurate local times.

## Acceptance Criteria

1. **Tenant switcher luôn visible** — User ở bất kỳ trang nào trong app → thanh sidebar hiển thị tên tenant hiện tại ở đầu (thay thế `<AppTitle />` placeholder bằng `<TeamSwitcher />`). Tenant switcher accessible ≤ 2 clicks.

2. **Switch tenant** — User là member của nhiều tenants → mở tenant switcher → chọn tenant khác → app switch context:
   - `UPDATE users.active_tenant_id = newTenantId` (lưu vào DB cho JWT hook đọc)
   - `supabase.auth.refreshSession()` → hook đọc `users.active_tenant_id` mới → JWT có `active_tenant_id` mới
   - `useTenantStore.getState().initFromSession(newSession.access_token)` + `setActiveTenant(newTenantId)`
   - Navigate đến `/dashboard` để refresh data với tenant context mới
   - Tất cả RLS queries dùng `active_tenant_id` mới từ JWT

3. **Personal timezone** — User truy cập `/settings/profile` → section "Timezone cá nhân" → searchable Select (danh sách IANA timezones phổ biến) → chọn timezone → save → `UPDATE users.timezone` → toast.success → tất cả timestamp displays trong app reflect timezone mới (trong các stories sau).

4. **Timezone mặc định khi đăng ký** — Users table: `timezone DEFAULT 'UTC'`. Sau khi join team, user nên set timezone cá nhân. Phần này nhắc user nếu `timezone === 'UTC'` và họ chưa bao giờ set.

5. **Session invalidation handler** — Khi user bị remove khỏi tenant (Story 1.6), `auth.admin.signOut(userId)` được gọi server-side. Khi user cố navigate hoặc thực hiện API call → Supabase trả về 401/session error → `src/lib/query-client.ts` global error handler detect → `toast.error("Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.")` → redirect đến `/sign-in`. (Kiểm tra + cải thiện existing global error handler.)

6. **ROUTES update** — Thêm `app.settings.profile` vào ROUTES nếu chưa có. (Kiểm tra `src/lib/routes.ts` — hiện tại có `settings.profile: '/settings/profile'` ✅).

7. **users.active_tenant_id migration** — Thêm column `active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL` vào `users` table. Update `custom_access_token_hook` để đọc từ column này nếu khác NULL.

## Tasks / Subtasks

- [x] Task 1: Tạo migration thêm users.active_tenant_id (AC: 2, 7)
  - [x] Tạo `supabase/migrations/20260324000007_add_active_tenant_id_to_users.sql`
  - [x] `ALTER TABLE public.users ADD COLUMN active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;`
  - [x] Update `custom_access_token_hook` để ưu tiên `users.active_tenant_id` nếu không NULL

- [x] Task 2: Tạo settings feature structure (AC: 3)
  - [x] Tạo `src/features/settings/services/settings.service.ts` — updateTimezone, updateActiveTenant
  - [x] Tạo `src/features/settings/schemas/settings.schema.ts` — timezoneSchema
  - [x] Tạo `src/features/settings/hooks/use-update-timezone.ts` — useMutation

- [x] Task 3: Update query-keys.ts (AC: 3)
  - [x] Thêm `userProfile: 'user-profile'` vào QUERY_KEYS (dùng cho useQuery profile data)

- [x] Task 4: Tạo TimezoneSelector component (AC: 3)
  - [x] Tạo `src/features/settings/components/TimezoneSelector.tsx`
  - [x] Props: `value: string`, `onChange: (tz: string) => void`, `disabled?: boolean`
  - [x] Dùng shadcn `Select` với danh sách IANA timezones
  - [x] Tái sử dụng `COMMON_TIMEZONES` list từ `settings/team.tsx` (đã extract vào `src/lib/timezones.ts`)

- [x] Task 5: Cập nhật settings/profile.tsx (AC: 3, 4)
  - [x] Thêm section "Timezone cá nhân" với `TimezoneSelector` + save button
  - [x] Dùng `useQuery` để load `users.timezone` hiện tại
  - [x] Dùng `useUpdateTimezone` mutation để save
  - [x] Nếu timezone === 'UTC' → hiện hint "Bạn chưa set timezone cá nhân."

- [x] Task 6: Wire TeamSwitcher vào AppSidebar (AC: 1, 2)
  - [x] Sửa `src/components/layout/app-sidebar.tsx`:
    - [x] Thêm query lấy tenant names từ `tenants` table dựa trên `useTenantStore().tenants`
    - [x] Uncomment `<TeamSwitcher>` (hiện tại bị comment), xóa `<AppTitle />`
    - [x] Pass teams data thực từ tenant store + tenants query
    - [x] Implement `onSwitch` handler: updateActiveTenant() + refreshSession() + navigate
  - [x] Sửa `src/components/layout/team-switcher.tsx`:
    - [x] Wire `onSwitch` prop để trigger real tenant switching
    - [x] Xóa internal `setActiveTeam` state (dùng tenant store làm source of truth)

- [x] Task 7: Cải thiện session invalidation handler (AC: 5)
  - [x] Sửa `src/lib/query-client.ts` — global `QueryCache.onError`
  - [x] Detect error code 401, "Session not found", "JWT expired", "User not found"
  - [x] Show toast.error("Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.")
  - [x] Redirect đến ROUTES.signIn
  - [x] Thêm `supabase.auth.onAuthStateChange()` listener trong `_app/route.tsx` để catch session invalidation real-time

## Dev Notes

### Foundation từ Các Story Trước — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | **CHỈ dùng cái này** |
| `src/stores/auth-store.ts` | ✅ có user, session | `user.id` cần cho updateActiveTenant |
| `src/stores/tenant-store.ts` | ✅ có initFromSession, setActiveTenant, tenants[] | Core cho switching |
| `src/lib/query-keys.ts` | ✅ | **THÊM** `userProfile` key |
| `src/lib/routes.ts` | ✅ có `settings.profile: '/settings/profile'` | Không cần sửa |
| `src/lib/permissions.ts` | ✅ | Không cần sửa |
| `src/components/layout/team-switcher.tsx` | ✅ có component cơ bản + comments TODO 1.7 | **SỬA** để wire real data |
| `src/components/layout/app-sidebar.tsx` | ✅ có `<TeamSwitcher>` bị comment | **SỬA** để uncomment + wire |
| `src/routes/_app/settings/profile.tsx` | ✅ chỉ có ChangePasswordForm | **SỬA** thêm Timezone section |
| `src/routes/_app/settings/team.tsx` | ✅ COMMON_TIMEZONES đã có | Extract thành shared constant |
| `src/lib/query-client.ts` | ✅ có global error handler | **SỬA** cải thiện session invalidation |
| `supabase/migrations/20260323000012_custom_access_token_hook.sql` | ✅ có hook | **UPDATE** để support active_tenant_id |
| `src/features/auth/services/auth.service.ts` | ✅ tham khảo | Pattern cho service functions |

### Database Schema Changes

**Migration 20260323000015_add_active_tenant_id_to_users.sql:**
```sql
-- Thêm active_tenant_id vào users để hỗ trợ tenant switching
ALTER TABLE public.users
  ADD COLUMN active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Index để hook query nhanh
CREATE INDEX idx_users_active_tenant_id ON public.users(id) WHERE active_tenant_id IS NOT NULL;
```

**Updated custom_access_token_hook:**
```sql
-- Update function trong 20260323000012 (hoặc tạo migration mới để REPLACE):
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims          jsonb;
  tenant_roles    jsonb;
  active_tenant   uuid;
  default_tenant  uuid;
  uid             uuid;
BEGIN
  uid := (event->>'user_id')::uuid;

  SELECT jsonb_object_agg(tenant_id::text, role)
  INTO   tenant_roles
  FROM   public.tenant_members
  WHERE  user_id = uid AND status = 'active';

  -- IG-1 UPDATED: Ưu tiên users.active_tenant_id nếu đã set VÀ user còn là member
  SELECT u.active_tenant_id INTO active_tenant
  FROM   public.users u
  WHERE  u.id = uid;

  -- Validate: active_tenant_id phải là tenant user còn active membership
  IF active_tenant IS NOT NULL THEN
    PERFORM 1 FROM public.tenant_members
    WHERE tenant_id = active_tenant AND user_id = uid AND status = 'active';
    IF NOT FOUND THEN
      active_tenant := NULL;  -- Reset nếu không còn member
    END IF;
  END IF;

  -- Fallback: dùng tenant đầu tiên theo created_at
  IF active_tenant IS NULL THEN
    SELECT tenant_id INTO default_tenant
    FROM   public.tenant_members
    WHERE  user_id = uid AND status = 'active'
    ORDER BY created_at LIMIT 1;
    active_tenant := default_tenant;
  END IF;

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_roles}',    COALESCE(tenant_roles, '{}'::jsonb));
  claims := jsonb_set(claims, '{active_tenant_id}', COALESCE(to_jsonb(active_tenant::text), 'null'::jsonb));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '';
```

⚠️ **QUAN TRỌNG**: Migration này cần `REPLACE OR CREATE` function trong hook.
Có 2 cách:
1. Tạo file migration mới `20260323000015_add_active_tenant_id_to_users.sql` chứa cả 2 lệnh (ALTER TABLE + OR REPLACE FUNCTION)
2. Sửa trực tiếp file `20260323000012_custom_access_token_hook.sql` (nếu migration chưa được apply lên production)

**Khuyến nghị**: Tạo migration mới (số 15) để giữ history sạch.

### settings.service.ts — Pattern

```typescript
// src/features/settings/services/settings.service.ts
import { supabase } from '@/lib/supabase-browser'

export const updateTimezone = async (userId: string, timezone: string): Promise<void> => {
  const { data, error } = await supabase
    .from('users')
    .update({ timezone })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update failed — check RLS policies')
}

export const updateActiveTenant = async (userId: string, tenantId: string): Promise<void> => {
  // Lưu active_tenant_id vào DB để custom_access_token_hook đọc được
  const { data, error } = await supabase
    .from('users')
    .update({ active_tenant_id: tenantId })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update failed — check RLS policies')
}

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, timezone, active_tenant_id')
    .eq('id', userId)
    .single()
  if (error) throw error
  if (!data) throw new Error('User profile not found')
  return data
}
```

### AppSidebar — Tenant Switcher Wire-up

```typescript
// src/components/layout/app-sidebar.tsx (SỬA)
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { useTenantStore } from '@/stores/tenant-store'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase-browser'
import { updateActiveTenant } from '@/features/settings/services/settings.service'
import { toast } from 'sonner'
import { ROUTES } from '@/lib/routes'
import { TeamSwitcher } from './team-switcher'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { tenants, activeTenantId, initFromSession, setActiveTenant } = useTenantStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // Query tenant names từ DB dựa trên tenant IDs trong store
  const tenantIds = tenants.map(t => t.tenantId)
  const { data: tenantRecords } = useQuery({
    queryKey: ['tenant-names', tenantIds],
    queryFn: async () => {
      if (tenantIds.length === 0) return []
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds)
      if (error) throw error
      return data ?? []
    },
    enabled: tenantIds.length > 0,
    staleTime: 5 * 60 * 1000,  // Cache 5 phút — team names ít thay đổi
  })

  // Build teams array cho TeamSwitcher
  const teams = tenants.map(t => ({
    id: t.tenantId,
    name: tenantRecords?.find(r => r.id === t.tenantId)?.name ?? 'Loading...',
    logo: Building2,  // Default icon
    plan: t.role,     // Hiển thị role dưới team name
  }))

  const handleSwitch = async (newTenantId: string) => {
    if (!user || newTenantId === activeTenantId) return
    try {
      // 1. Lưu active_tenant_id vào DB để hook đọc được
      await updateActiveTenant(user.id, newTenantId)

      // 2. Refresh session để JWT có active_tenant_id mới
      const { data: refreshData, error } = await supabase.auth.refreshSession()
      if (error) throw error
      if (!refreshData.session) throw new Error('Session refresh returned null')

      // 3. Update client stores
      initFromSession(refreshData.session.access_token)
      setActiveTenant(newTenantId)

      // 4. Navigate về dashboard để reload data với tenant context mới
      await navigate({ to: ROUTES.app.dashboard })
    } catch {
      toast.error('Không thể chuyển team. Vui lòng thử lại.')
    }
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Story 1.7: Thay AppTitle bằng TeamSwitcher thực */}
        <TeamSwitcher teams={teams} onSwitch={handleSwitch} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
```

**Lưu ý**: `QUERY_KEYS` không có key cho `tenant-names`. Dùng string trực tiếp `'tenant-names'` là OK vì đây là internal query trong component, không cần centralized key. Hoặc thêm `tenantNames: 'tenant-names'` vào `query-keys.ts`.

### TeamSwitcher — Update (remove internal state)

```typescript
// src/components/layout/team-switcher.tsx (SỬA)
// Bỏ internal useState cho activeTeam — dùng prop + activeTenantId từ parent
// Giữ nguyên UI, chỉ wire thực active team từ useTenantStore

import { useTenantStore } from '@/stores/tenant-store'

export function TeamSwitcher({ teams, onSwitch }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { activeTenantId } = useTenantStore()

  // Derive activeTeam từ store thay vì internal state
  const activeTeam = teams.find(t => t.id === activeTenantId) ?? teams[0]

  // Bỏ useEffect sync và useState
  // ...rest của component giữ nguyên
}
```

### settings/profile.tsx — Timezone Section

```typescript
// src/routes/_app/settings/profile.tsx (SỬA)

import { useAuthStore } from '@/stores/auth-store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserProfile, updateTimezone } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { toast } from 'sonner'

// Thêm section sau ChangePasswordForm:
function ProfilePage() {
  return (
    <div className='space-y-6'>
      {/* Section 1: Đổi mật khẩu (existing) */}
      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
          ...
        </CardHeader>
        <CardContent><ChangePasswordForm /></CardContent>
      </Card>

      {/* Section 2: Timezone cá nhân (MỚI - Story 1.7) */}
      <TimezoneSection />
    </div>
  )
}

function TimezoneSection() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  })

  const mutation = useMutation({
    mutationFn: (timezone: string) => updateTimezone(user!.id, timezone),
    onSuccess: () => {
      toast.success('Đã lưu timezone')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.userProfile, user?.id] })
    },
    onError: () => toast.error('Không thể lưu timezone. Vui lòng thử lại.'),
  })

  if (isLoading) return <Skeleton ... />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timezone cá nhân</CardTitle>
        <CardDescription>Timestamps trong app sẽ hiển thị theo timezone này</CardDescription>
      </CardHeader>
      <CardContent>
        {profile?.timezone === 'UTC' && (
          <Alert className="mb-4">
            <AlertDescription>Bạn chưa set timezone cá nhân. Vui lòng chọn timezone phù hợp.</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <TimezoneSelector
              value={profile?.timezone ?? 'UTC'}
              onChange={(tz) => mutation.mutate(tz)}
              disabled={mutation.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Session Invalidation Handler — query-client.ts

```typescript
// src/lib/query-client.ts (SỬA / kiểm tra existing handler)
// Existing handler likely has 401 redirect.
// Cần thêm: friendly message trước khi redirect

// Trong QueryCache.onError hoặc global fetch error handler:
const isSessionError = (error: unknown): boolean => {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  return (
    msg.includes('JWT expired') ||
    msg.includes('not authenticated') ||
    msg.includes('session_not_found') ||
    (error as { status?: number }).status === 401
  )
}

// Nếu detect session error:
if (isSessionError(error)) {
  toast.error('Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.')
  // Small delay để user thấy toast trước khi redirect
  setTimeout(() => {
    window.location.href = ROUTES.signIn
  }, 1500)
  return  // Không show generic error
}
```

**Thêm auth state listener trong `_app/route.tsx` hoặc `__root.tsx`:**
```typescript
// Detect session invalidation real-time (không chỉ khi có API call)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !isManualSignOut) {
      // User bị sign out từ server (remove-member)
      toast.error('Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.')
      navigate({ to: ROUTES.signIn })
    }
  })
  return () => subscription.unsubscribe()
}, [])
```

### QUERY_KEYS update

```typescript
// src/lib/query-keys.ts (SỬA)
export const QUERY_KEYS = {
  // ... existing keys ...
  userProfile: 'user-profile',  // ← THÊM MỚI
  tenantNames: 'tenant-names',  // ← THÊM MỚI (optional, cho sidebar query)
} as const
```

### COMMON_TIMEZONES — Extract thành shared constant

```typescript
// Hiện tại COMMON_TIMEZONES được define trong settings/team.tsx (Story 1.4)
// Story 1.7 cần dùng lại trong TimezoneSelector → extract vào shared location

// Option 1: Tạo src/lib/timezones.ts
// Option 2: Tạo src/features/settings/data/timezones.ts
// Khuyến nghị: src/lib/timezones.ts (share giữa tenant và settings feature)

// src/lib/timezones.ts
export const COMMON_TIMEZONES = [
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
] as const

// Sau đó update settings/team.tsx để import từ đây thay vì define inline
```

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG dùng Supabase Realtime | Dùng `refetchInterval` nếu cần polling |
| ❌ KHÔNG dùng optimistic updates | `isPending` state |
| ❌ KHÔNG tạo thêm `createClient()` | Dùng singleton |
| ✅ Tenant switch: UPDATE DB trước, THEN refreshSession() | Đảm bảo hook đọc đúng active_tenant_id |
| ✅ TeamSwitcher: derive active team từ useTenantStore | Store là source of truth (không dùng internal useState) |
| ✅ `onAuthStateChange` unsubscribe trong cleanup | Tránh memory leak |

### Project Structure — Files cần tạo/sửa

```
src/
├── lib/
│   ├── query-keys.ts                              ← SỬA (thêm userProfile, tenantNames)
│   ├── query-client.ts                            ← SỬA (cải thiện session invalidation)
│   └── timezones.ts                               ← TẠO MỚI (extract COMMON_TIMEZONES)
├── features/settings/                             ← TẠO MỚI folder
│   ├── services/
│   │   └── settings.service.ts                   ← TẠO MỚI (updateTimezone, updateActiveTenant, getUserProfile)
│   ├── hooks/
│   │   └── use-update-timezone.ts                ← TẠO MỚI
│   ├── schemas/
│   │   └── settings.schema.ts                    ← TẠO MỚI (timezoneSchema)
│   └── components/
│       └── TimezoneSelector.tsx                  ← TẠO MỚI
├── components/layout/
│   ├── app-sidebar.tsx                           ← SỬA (uncomment TeamSwitcher, wire data + onSwitch)
│   └── team-switcher.tsx                         ← SỬA (bỏ internal state, derive từ store)
└── routes/
    ├── __root.tsx                                ← KHÔNG SỬA (onAuthStateChange đã có trong auth-store)
    └── _app/
        ├── route.tsx                             ← SỬA (thêm onAuthStateChange listener trong AppLayout)
        └── settings/
            ├── profile.tsx                       ← SỬA (thêm TimezoneSection)
            └── team.tsx                          ← SỬA nhỏ (import COMMON_TIMEZONES từ lib/timezones.ts)
supabase/
└── migrations/
    └── 20260324000007_add_active_tenant_id_to_users.sql  ← TẠO MỚI
```

### Thứ tự Implementation được khuyến nghị

1. **Task 1** (migration + hook update) — DB foundation trước
2. **Task 3** (query-keys.ts) — thêm keys cần thiết
3. **Task 2** (settings feature: service + schema) — data layer
4. **Task 4** (TimezoneSelector component + `lib/timezones.ts`) — shared UI
5. **Task 5** (settings/profile.tsx + TimezoneSection) — timezone UI
6. **Task 6** (AppSidebar + TeamSwitcher wire-up) — complex part
7. **Task 7** (query-client.ts + onAuthStateChange) — polish

### Learnings từ Stories 1.4, 1.5, 1.6 — Vẫn áp dụng

- `refreshSession()` sau update active_tenant_id là BẮT BUỘC để JWT embed đúng tenant
- `useTenantStore.getState()` bên ngoài React component (trong async handlers)
- `initFromSession()` + `setActiveTenant()` sequence sau refreshSession
- Edge Function + admin client: `supabase.auth.admin.signOut()` (KHÔNG phải `supabase.auth.signOut()`)
- Named exports only — không `export default`
- `cn()` từ `@/lib/utils` cho className — không dùng clsx/twMerge trực tiếp
- `select('id').single()` sau UPDATE để detect silent RLS failures
- Sau khi user switch tenant → toàn bộ React Query cache cần được cleared hoặc invalidated (dùng `queryClient.clear()` trước khi navigate)

### Query Cache Clear khi Switch Tenant

⚠️ **QUAN TRỌNG**: Sau khi switch tenant, toàn bộ data cache (schedules, members, reports, v.v.) là stale vì thuộc về tenant cũ. Cần clear cache:

```typescript
// Trong handleSwitch (AppSidebar):
queryClient.clear()  // Clear toàn bộ cache
// Sau đó navigate → trang mới fetch fresh data với tenant context mới
await navigate({ to: ROUTES.app.dashboard })
```

`queryClient` có thể lấy từ `useQueryClient()` hook trong component.

### Error Messages (UX)

| Tình huống | Loại | Message |
|---|---|---|
| Timezone saved | Toast success | `"Đã lưu timezone"` |
| Timezone save failed | Toast error | `"Không thể lưu timezone. Vui lòng thử lại."` |
| Tenant switch thành công | (silent — navigate refresh data) | — |
| Tenant switch failed | Toast error | `"Không thể chuyển team. Vui lòng thử lại."` |
| Session bị thu hồi | Toast error | `"Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại."` |
| Timezone chưa set | Inline alert | `"Bạn chưa set timezone cá nhân. Vui lòng chọn timezone phù hợp."` |

### References

- FR3: `epics.md` — Thiết lập timezone cá nhân
- FR4: `epics.md` — Xem và chuyển đổi tenant membership
- FR5: `epics.md` — Session invalidation khi bị remove khỏi tenant
- DB Schema: `supabase/migrations/20260323000001_create_users.sql`
- JWT Hook: `supabase/migrations/20260323000012_custom_access_token_hook.sql`
- TeamSwitcher component: `src/components/layout/team-switcher.tsx` (có TODO Story 1.7 comments)
- AppSidebar: `src/components/layout/app-sidebar.tsx` (có TeamSwitcher bị comment)
- Tenant Store: `src/stores/tenant-store.ts`

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5

### Debug Log References
- Migration: `20260324000007_add_active_tenant_id_to_users.sql` — applied thành công
- TypeScript: `npx tsc --noEmit` — 0 errors
- ESLint: 0 warnings, 0 errors trên toàn bộ files thay đổi
- DB Tests: 17/17 PASS (`npx supabase test db`)
- Vite Build: Thành công (6.67s, 2151 modules)

### Completion Notes List
- ✅ Task 1: Migration `20260324000007` tạo column `active_tenant_id` trên `users` table + update `custom_access_token_hook` để ưu tiên column này. Index được tạo. Migration applied và verified qua MCP.
- ✅ Task 2: Settings feature structure tạo đủ — `settings.service.ts` (updateTimezone, updateActiveTenant, getUserProfile), `settings.schema.ts` (timezoneSchema với zod enum validation), `use-update-timezone.ts` hook
- ✅ Task 3: `query-keys.ts` thêm `userProfile` và `tenantNames` keys
- ✅ Task 4: `TimezoneSelector.tsx` component + `src/lib/timezones.ts` shared constant (extract từ `settings/team.tsx`)
- ✅ Task 5: `settings/profile.tsx` — thêm `TimezoneSection` component với useQuery + useUpdateTimezone + inline alert khi timezone === 'UTC'
- ✅ Task 6: `app-sidebar.tsx` — wire TeamSwitcher với tenant query, handleSwitch (updateActiveTenant → refreshSession → initFromSession → setActiveTenant → queryClient.clear() → navigate). `team-switcher.tsx` — bỏ internal useState, derive activeTeam từ `useTenantStore`
- ✅ Task 7: `query-client.ts` — cải thiện session error detection (401, JWT expired, session_not_found, User not found) + friendly toast trước redirect. `auth-store.ts` — thêm `isManualSignOut` flag. `_app/route.tsx` — thêm `onAuthStateChange` listener với unsubscribe cleanup

### Implementation Plan
1. DB migration với `active_tenant_id` column + update `custom_access_token_hook`
2. `src/lib/timezones.ts` — extract COMMON_TIMEZONES dùng chung
3. Settings feature: service, schema, hook
4. `query-keys.ts` update (userProfile, tenantNames)
5. `TimezoneSelector` component
6. `profile.tsx` — thêm TimezoneSection
7. `team.tsx` — import COMMON_TIMEZONES từ shared lib
8. `team-switcher.tsx` — bỏ internal state, derive từ store
9. `app-sidebar.tsx` — wire TeamSwitcher với real data + handleSwitch + queryClient.clear()
10. `query-client.ts` — improved session invalidation handler
11. `auth-store.ts` — isManualSignOut flag
12. `_app/route.tsx` — onAuthStateChange listener

### File List
- `supabase/migrations/20260324000007_add_active_tenant_id_to_users.sql` ← TẠO MỚI
- `src/lib/timezones.ts` ← TẠO MỚI
- `src/lib/query-keys.ts` ← SỬA (thêm userProfile, tenantNames)
- `src/lib/query-client.ts` ← SỬA (improved session invalidation)
- `src/features/settings/services/settings.service.ts` ← TẠO MỚI
- `src/features/settings/schemas/settings.schema.ts` ← TẠO MỚI
- `src/features/settings/hooks/use-update-timezone.ts` ← TẠO MỚI
- `src/features/settings/components/TimezoneSelector.tsx` ← TẠO MỚI
- `src/components/layout/app-sidebar.tsx` ← SỬA (TeamSwitcher wire-up)
- `src/components/layout/team-switcher.tsx` ← SỬA (remove internal state)
- `src/routes/_app/route.tsx` ← SỬA (onAuthStateChange listener)
- `src/routes/_app/settings/profile.tsx` ← SỬA (TimezoneSection)
- `src/routes/_app/settings/team.tsx` ← SỬA (import COMMON_TIMEZONES)
- `src/stores/auth-store.ts` ← SỬA (isManualSignOut flag)

## Change Log

- 2026-03-24: Story 1.7 created — Tenant Switcher & Personal Profile
- 2026-03-24: Story 1.7 implemented — Tất cả 7 tasks hoàn thành. DB migration applied, TypeScript 0 errors, ESLint 0 warnings, DB tests 17/17 PASS, Vite build thành công.
