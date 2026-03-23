# Story 1.1: Project Setup & Supabase Foundation

Status: review

## Story

As a developer,
I want the TekSpace project initialized with complete database schema, RLS policies, and shared frontend foundation,
so that all parallel development agents can work independently without schema conflicts or setup blockers.

## Acceptance Criteria

1. **Project chạy được locally** — clone SpeakPing-Admin, rename, xóa SpeakPing-specific code, kết nối Supabase thành công (`npm run dev` không lỗi).

2. **13 migration files được tạo và apply** theo đúng thứ tự:
   - `20260323000001_create_users.sql`
   - `20260323000002_create_tenants.sql`
   - `20260323000003_create_tenant_members.sql`
   - `20260323000004_create_tenant_invites.sql`
   - `20260323000005_create_schedule_weeks.sql`
   - `20260323000006_create_schedule_slots.sql`
   - `20260323000007_create_daily_reports.sql`
   - `20260323000008_create_notifications.sql`
   - `20260323000009_create_incidents.sql`
   - `20260323000010_create_incident_appeals.sql`
   - `20260323000011_rls_policies.sql`
   - `20260323000012_custom_access_token_hook.sql`
   - `20260323000013_pg_cron_jobs.sql`

3. **RLS policies active** trên tất cả data tables với helper `current_tenant_id()` — verified bằng cách query Supabase dashboard.

4. **Custom Access Token Hook** được enable — embed `tenant_roles: { tenantId: role }` vào JWT.

5. **Extensions** `pg_cron` và `pg_net` được enable trong Supabase Dashboard.

6. **`app.edge_function_url`** và **`app.service_role_key`** được set trong DB settings.

7. **4 Edge Functions deployed** (stub implementations đủ để build — logic thực tế cho Epic 1 stories sau):
   - `remove-member`
   - `notify-schedule-change`
   - `send-invite`
   - `notify-schedule-reminder`

8. **Tất cả shared frontend libs được tạo:**
   - `src/lib/supabase-browser.ts`
   - `src/lib/supabase-types.ts` (generated từ Supabase CLI)
   - `src/lib/query-client.ts`
   - `src/lib/permissions.ts`
   - `src/lib/routes.ts`
   - `src/lib/query-keys.ts`
   - `src/stores/auth-store.ts`
   - `src/stores/tenant-store.ts`

9. **Routes placeholder:**
   - `src/routes/__root.tsx` (Providers setup)
   - `src/routes/sign-in.tsx` (placeholder — sẽ implement đầy đủ trong Story 1.2)
   - `src/routes/_app/route.tsx` (layout + auth guard placeholder)

10. **Schema conventions tuân thủ đầy đủ:**
    - `tenant_id` là cột thứ 2 trong mọi data table (trừ `users` và `tenants`)
    - Primary key: `id uuid DEFAULT gen_random_uuid()`
    - Timestamps: `created_at`, `updated_at` (không tên khác)
    - RLS policy names: `{table}_{operation}_policy`

11. **SpeakPing cleanup hoàn tất** — không còn references đến SpeakPing features, chỉ còn shared UI components.

## Tasks / Subtasks

- [x] Task 1: Clone & Cleanup Project Base (AC: 1, 11)
  - [x] Copy SpeakPing-Admin sang folder `tekspace`
  - [x] Update `package.json`: name → `tekspace`, xóa `axios`, thêm `@supabase/supabase-js`, `@supabase/ssr`, `jwt-decode`, `date-fns-tz`
  - [x] Xóa `src/features/` cũ của SpeakPing (recordings, admin, v.v.)
  - [x] Tạo TekSpace feature structure: `src/features/{auth,tenant,schedule,dashboard,daily-report,analytics,notifications,incidents,settings}/`
  - [x] Xóa `src/lib/api.ts` (Axios client)
  - [x] Verify `npm run dev` chạy được sau cleanup

- [x] Task 2: Supabase CLI Setup (AC: 5, 6)
  - [x] `supabase init` — tạo `supabase/` folder
  - [ ] Enable extensions trong Supabase Dashboard: `pg_cron`, `pg_net` ⚠️ MANUAL STEP
  - [ ] Configure Auth: Site URL + Redirect URLs, disable email confirmation ⚠️ MANUAL STEP
  - [ ] Set DB app settings: `app.edge_function_url`, `app.service_role_key` ⚠️ MANUAL STEP

- [x] Task 3: Database Migrations (AC: 2, 10)
  - [x] `20260323000001_create_users.sql` — profile table synced với auth.users
  - [x] `20260323000002_create_tenants.sql` — team workspace
  - [x] `20260323000003_create_tenant_members.sql` — RBAC roles per-tenant
  - [x] `20260323000004_create_tenant_invites.sql` — invite lifecycle
  - [x] `20260323000005_create_schedule_weeks.sql` — weekly tracking + deadline
  - [x] `20260323000006_create_schedule_slots.sql` — time slots (UTC + duration)
  - [x] `20260323000007_create_daily_reports.sql` — structured daily report + tasks
  - [x] `20260323000008_create_notifications.sql` — in-app notification center
  - [x] `20260323000009_create_incidents.sql` — incident logging (append-only)
  - [x] `20260323000010_create_incident_appeals.sql` — appeal responses
  - [ ] Apply migrations: `supabase db push` ⚠️ MANUAL STEP (cần Supabase project)

- [x] Task 4: RLS Policies (AC: 3)
  - [x] `20260323000011_rls_policies.sql` — tất cả RLS policies với `current_tenant_id()` helper
  - [x] Enable RLS trên tất cả data tables (trong migration files)
  - [ ] Verify policies trong Supabase Dashboard ⚠️ MANUAL STEP (sau khi apply)

- [x] Task 5: Custom Access Token Hook (AC: 4)
  - [x] `20260323000012_custom_access_token_hook.sql` — function + GRANT
  - [ ] Enable hook tại: Authentication → Hooks → Custom Access Token ⚠️ MANUAL STEP

- [x] Task 6: pg_cron Jobs (AC: 2, 6)
  - [x] `20260323000013_pg_cron_jobs.sql` — schedule 4 cron jobs
  - [ ] Verify jobs xuất hiện trong `cron.job` table ⚠️ MANUAL STEP (sau khi apply)

- [x] Task 7: Edge Function Stubs (AC: 7)
  - [x] `supabase/functions/_shared/cors.ts` — CORS headers
  - [x] `supabase/functions/_shared/supabase-admin.ts` — service role client
  - [x] `supabase/functions/_shared/resend.ts` — Resend email helper stub
  - [x] `supabase/functions/remove-member/index.ts` — stub (returns 200)
  - [x] `supabase/functions/notify-schedule-change/index.ts` — stub
  - [x] `supabase/functions/send-invite/index.ts` — stub
  - [x] `supabase/functions/notify-schedule-reminder/index.ts` — stub
  - [ ] `supabase functions deploy` tất cả ⚠️ MANUAL STEP (cần Supabase project)
  - [ ] Set Secrets: `RESEND_API_KEY`, `APP_URL` ⚠️ MANUAL STEP

- [x] Task 8: Generate Supabase Types (AC: 8)
  - [x] `src/lib/supabase-types.ts` — placeholder types với đầy đủ schema (cần regenerate sau khi apply migrations)
  - [ ] `supabase gen types typescript --project-id xxx > src/lib/supabase-types.ts` ⚠️ MANUAL STEP (sau khi apply migrations)

- [x] Task 9: Frontend Shared Libs (AC: 8)
  - [x] `src/lib/supabase-browser.ts` — singleton Supabase client
  - [x] `src/lib/query-client.ts` — QueryClient + global error handler (401 → redirect sign-in)
  - [x] `src/lib/permissions.ts` — đầy đủ Permission types + ROLE_PERMISSIONS map
  - [x] `src/lib/routes.ts` — ROUTES constant đầy đủ
  - [x] `src/lib/query-keys.ts` — QUERY_KEYS constant

- [x] Task 10: Zustand Stores (AC: 8)
  - [x] `src/stores/auth-store.ts` — AuthState interface + implementation
  - [x] `src/stores/tenant-store.ts` — TenantState interface + implementation

- [x] Task 11: Base Routes & Providers (AC: 9)
  - [x] `src/routes/__root.tsx` — QueryClientProvider + RouterContext + Toaster (Sonner)
  - [x] `src/routes/sign-in.tsx` — placeholder UI (sẽ implement trong Story 1.2)
  - [x] `src/routes/_app/route.tsx` — Layout placeholder + auth guard stub
  - [x] Verify routing tree compiles (`routeTree.gen.ts` được generate bởi Vite)

- [x] Task 12: `.env.local` & `.env.example` (AC: 1)
  - [x] `.env` với VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL (placeholder)
  - [x] `.env.example` với placeholder values (commit vào git, `.env.local` không commit)
  - [x] Update `.gitignore` — đảm bảo `.env.local` không bị commit

- [x] Task 13: Final Verification (AC: 1–11)
  - [x] TypeScript compile — không có lỗi (`npx tsc --noEmit` pass)
  - [x] `npm run build` — build thành công (234 modules, dist generated)
  - [x] Tất cả code AC được implement

## Dev Notes

### ⚠️ Phase 0 — Serial Prerequisite
Story này là **Phase 0 blocker** — TOÀN BỘ parallel agents cho Epic 2–7 phải đợi story này xong. Không làm tắt, không bỏ qua bất kỳ item nào trong checklist.

### Stack Versions (bắt buộc tuân theo)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Language | TypeScript | ~5.9 strict mode |
| Build | Vite + SWC | 7 |
| Routing | TanStack Router | 1.x |
| Server State | TanStack React Query | 5.x |
| Client State | Zustand | 5.x |
| UI | ShadcnUI + Radix UI | latest |
| Styling | TailwindCSS | v4 (Vite plugin) |
| Forms | React Hook Form + Zod | latest |
| Icons | Lucide React | latest |
| Date/Timezone | date-fns-tz | latest |
| Supabase client | @supabase/supabase-js | latest |
| Toast | Sonner (đã có trong SpeakPing) | — |

### Database Schema — Bắt buộc

> **Rule tuyệt đối:** `tenant_id` là cột **thứ 2** (sau `id`) trong mọi data table. Primary key: `id uuid DEFAULT gen_random_uuid()`. Timestamps: `created_at`, `updated_at`.

#### 1. `users` — Cross-tenant profile (không có tenant_id)
```sql
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  avatar_url  text,
  timezone    text NOT NULL DEFAULT 'UTC',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Trigger: auto-insert khi auth.users tạo mới (hook vào auth.users INSERT)
```

#### 2. `tenants` — Team workspace (không có tenant_id — IS the tenant)
```sql
CREATE TABLE public.tenants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  timezone                    text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  schedule_deadline_day       smallint NOT NULL DEFAULT 0,   -- 0=Sunday
  schedule_deadline_hour      smallint NOT NULL DEFAULT 23,  -- 23:59
  daily_report_deadline_hour  smallint NOT NULL DEFAULT 3,   -- 03:00 next day
  default_committed_hours     smallint NOT NULL DEFAULT 40,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
```

#### 3. `tenant_members`
```sql
CREATE TYPE public.member_role AS ENUM ('owner', 'manager', 'member');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive');

CREATE TABLE public.tenant_members (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role              public.member_role   NOT NULL DEFAULT 'member',
  status            public.member_status NOT NULL DEFAULT 'active',
  committed_hours   smallint,   -- NULL = dùng tenant default
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user_id   ON public.tenant_members(user_id);
```

#### 4. `tenant_invites`
```sql
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');

CREATE TABLE public.tenant_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_by  uuid NOT NULL REFERENCES public.users(id),
  email       text NOT NULL,
  token       text NOT NULL UNIQUE,
  status      public.invite_status NOT NULL DEFAULT 'pending',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_invites_tenant_id ON public.tenant_invites(tenant_id);
CREATE INDEX idx_tenant_invites_token     ON public.tenant_invites(token);
```

#### 5. `schedule_weeks`
```sql
CREATE TABLE public.schedule_weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_of     date NOT NULL,   -- Monday of the week (ISO)
  deadline    timestamptz NOT NULL,
  is_locked   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, week_of)
);
CREATE INDEX idx_schedule_weeks_tenant_id ON public.schedule_weeks(tenant_id);
```

#### 6. `schedule_slots`
```sql
CREATE TABLE public.schedule_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id),
  week_id           uuid NOT NULL REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
  slot_date         date NOT NULL,        -- ngày của slot (ngày bắt đầu cho overnight slots)
  start_time        timestamptz NOT NULL, -- UTC absolute
  duration_minutes  smallint NOT NULL CHECK (duration_minutes >= 30 AND duration_minutes <= 720),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedule_slots_tenant_id ON public.schedule_slots(tenant_id);
CREATE INDEX idx_schedule_slots_user_id   ON public.schedule_slots(user_id);
CREATE INDEX idx_schedule_slots_week_id   ON public.schedule_slots(week_id);
```

#### 6b. `schedule_slot_changes` — Audit trail cho schedule edits (append-only)
```sql
CREATE TYPE public.slot_change_type AS ENUM ('created', 'updated', 'deleted', 'emergency_override');

CREATE TABLE public.schedule_slot_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slot_id     uuid NOT NULL REFERENCES public.schedule_slots(id),
  changed_by  uuid NOT NULL REFERENCES public.users(id),
  change_type public.slot_change_type NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — append-only, immutable
);
-- NOTE: Bao gồm trong migration 06 hoặc tách riêng nếu > 13 files
```

#### 7. `daily_reports`
```sql
CREATE TABLE public.daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id),
  report_date  date NOT NULL,
  tasks        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- tasks schema: [{ description: string, output_type: 'pr'|'figma'|'document'|'other', output_link?: string }]
  hours_logged numeric(4,1) NOT NULL DEFAULT 0,
  is_late      boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — append-only sau submit
  -- UNIQUE (tenant_id, user_id, report_date) — 1 report per member per day
);
CREATE INDEX idx_daily_reports_tenant_id ON public.daily_reports(tenant_id);
CREATE INDEX idx_daily_reports_user_id   ON public.daily_reports(user_id);
```

#### 8. `notifications`
```sql
CREATE TYPE public.notification_type AS ENUM (
  'schedule_reminder', 'schedule_missed', 'schedule_changed',
  'daily_report_reminder', 'member_removed', 'invite_sent',
  'incident_logged', 'appeal_submitted'
);

CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  type        public.notification_type NOT NULL,
  message     text NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  link_to     text,   -- route path (e.g. '/schedule', '/incidents')
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — chỉ update is_read
);
CREATE INDEX idx_notifications_user_id   ON public.notifications(user_id);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_is_read   ON public.notifications(is_read) WHERE is_read = false;
```

#### 9. `incidents` — Append-only, immutable
```sql
CREATE TYPE public.incident_category AS ENUM (
  'late_schedule', 'missed_report', 'low_commitment', 'policy_violation'
);

CREATE TABLE public.incidents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.users(id),
  manager_id  uuid NOT NULL REFERENCES public.users(id),
  category    public.incident_category NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — immutable, không bao giờ UPDATE hay DELETE
);
CREATE INDEX idx_incidents_tenant_id  ON public.incidents(tenant_id);
CREATE INDEX idx_incidents_member_id  ON public.incidents(member_id);
```

#### 10. `incident_appeals` — Append-only
```sql
CREATE TABLE public.incident_appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  member_id   uuid NOT NULL REFERENCES public.users(id),
  response    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — immutable
  -- UNIQUE (incident_id, member_id) — chỉ 1 appeal per incident per member
);
CREATE INDEX idx_incident_appeals_incident_id ON public.incident_appeals(incident_id);
```

### RLS Policies — File 11

```sql
-- Helper function (phải tạo TRƯỚC khi dùng trong policies)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'active_tenant_id')::uuid
$$ LANGUAGE sql STABLE;

-- KHÔNG dùng auth.uid() trực tiếp trong RLS nếu có thể dùng tenant isolation

-- Ví dụ pattern cho mỗi table:
-- Enable RLS
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY schedule_slots_select_policy ON public.schedule_slots
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Insert policy
CREATE POLICY schedule_slots_insert_policy ON public.schedule_slots
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Update policy
CREATE POLICY schedule_slots_update_policy ON public.schedule_slots
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
```

> **Lưu ý:** `current_tenant_id()` đọc từ JWT claim `active_tenant_id`. Tenant store sẽ refresh JWT sau khi user chọn tenant — cần coordinate với Story 1.7 (Tenant Switcher). Trong Phase 0, stub RLS dùng `auth.uid()` cũng được nhưng phải document để fix trong Story 1.7.

### Custom Access Token Hook — File 12

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  tenant_roles jsonb;
BEGIN
  SELECT jsonb_object_agg(tenant_id::text, role)
  INTO tenant_roles
  FROM public.tenant_members
  WHERE user_id = (event->>'user_id')::uuid
    AND status = 'active';

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_roles}', COALESCE(tenant_roles, '{}'::jsonb));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

Enable tại: **Supabase Dashboard → Authentication → Hooks → Custom Access Token**.

### pg_cron Jobs — File 13

```sql
-- Tất cả jobs dùng UTC time, tương đương giờ Việt Nam (ICT = UTC+7)
-- Chủ nhật 8PM ICT = Chủ nhật 13:00 UTC
SELECT cron.schedule(
  'remind-schedule-submission',
  '0 13 * * 0',   -- Chủ nhật 8PM ICT
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_function_url') || '/notify-schedule-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Chủ nhật 11:59PM ICT = Chủ nhật 16:59 UTC
SELECT cron.schedule('auto-create-empty-schedule',   '59 16 * * 0', $$...$$);

-- Hàng ngày 7PM ICT = 12:00 UTC
SELECT cron.schedule('remind-daily-report',           '0 12 * * *',  $$...$$);

-- Chủ nhật 11:59PM+5min ICT = Chủ nhật 17:04 UTC
SELECT cron.schedule('deadline-missed-notify',        '4 17 * * 0',  $$...$$);
```

### Frontend Foundation — Specs chính xác

#### `src/lib/supabase-browser.ts`
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
// TUYỆT ĐỐI KHÔNG createClient() lần 2 ở bất kỳ file nào khác
// Agents LUÔN import { supabase } từ đây
```

#### `src/lib/query-client.ts`
```typescript
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ROUTES } from './routes'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.status === 401 || error?.code === 'PGRST301') {
        window.location.href = ROUTES.signIn
        return
      }
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
```

#### `src/lib/routes.ts`
```typescript
export const ROUTES = {
  signIn: '/sign-in',
  acceptInvite: '/accept-invite',
  app: {
    dashboard: '/dashboard',
    schedule: '/schedule',
    scheduleManage: '/schedule/manage',
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    settings: {
      profile: '/settings/profile',
      team: '/settings/team',
    },
  },
} as const
```

#### `src/lib/query-keys.ts`
```typescript
export const QUERY_KEYS = {
  scheduleSlots: 'schedule-slots',
  scheduleWeeks: 'schedule-weeks',
  tenantMembers: 'tenant-members',
  tenantInvites: 'tenant-invites',
  dailyReports: 'daily-reports',
  notifications: 'notifications',
  incidents: 'incidents',
  incidentAppeals: 'incident-appeals',
  analytics: 'analytics',
} as const
```

#### `src/lib/permissions.ts`
```typescript
export type MemberRole = 'owner' | 'manager' | 'member'

export type Permission =
  | 'manageSchedule'
  | 'viewTeamSchedule'
  | 'approveSchedule'
  | 'submitDailyReport'
  | 'viewTeamDashboard'
  | 'manageMembers'
  | 'manageTenant'
  | 'createIncident'
  | 'viewAnalytics'

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner:   ['manageSchedule','viewTeamSchedule','approveSchedule','submitDailyReport','viewTeamDashboard','manageMembers','manageTenant','createIncident','viewAnalytics'],
  manager: ['manageSchedule','viewTeamSchedule','approveSchedule','submitDailyReport','viewTeamDashboard','createIncident','viewAnalytics'],
  member:  ['viewTeamSchedule','submitDailyReport','viewTeamDashboard','viewAnalytics'],
}

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
```

#### `src/stores/auth-store.ts`
```typescript
interface AuthState {
  user: User | null           // Supabase User object
  session: Session | null     // Supabase Session
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
}
// KHÔNG đặt tenant data vào auth store
// Subscribe to supabase.auth.onAuthStateChange trong store initialization
```

#### `src/stores/tenant-store.ts`
```typescript
interface TenantState {
  activeTenantId: string | null
  activeRole: MemberRole | null
  tenants: TenantMember[]
  setActiveTenant: (tenantId: string) => void
}
// KHÔNG đặt auth/session data vào tenant store
// Khởi tạo từ JWT claims (tenant_roles) khi session load
```

#### `src/routes/__root.tsx`
```typescript
// Providers: QueryClientProvider, TanStackRouterDevtools (dev only), Toaster (Sonner)
// RouterContext: { queryClient, supabase }
// KHÔNG wrap Suspense ở đây — để từng route tự handle
```

#### `src/routes/_app/route.tsx` (auth guard)
```typescript
// beforeLoad: check session từ useAuthStore
// Nếu no session → throw redirect({ to: ROUTES.signIn })
// Layout: Header + Sidebar + <Outlet />
// Story 1.2 sẽ implement sign-in form đầy đủ
// Story 1.7 sẽ implement tenant switcher logic
```

### Edge Function Stubs — Pattern
```typescript
// supabase/functions/{name}/index.ts
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // TODO: implement in Epic 1 stories
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

```typescript
// supabase/functions/_shared/supabase-admin.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
```

### Project Structure Notes

**Giữ nguyên từ SpeakPing-Admin (không chỉnh sửa):**
- `src/components/ui/` — 33 ShadcnUI components
- `src/components/data-table/` — DataTable, DataTableToolbar, DataTablePagination
- `src/components/layout/` — Header, Sidebar, SidebarNav, Main
- `src/hooks/use-debounce.ts`, `use-dialog-state.ts`, `use-mobile.ts`, `use-table-url-state.ts`
- `src/lib/utils.ts`, `src/lib/cookies.ts`
- `src/styles/` — theme.css, index.css (Tailwind v4)
- `.prettierrc`, `eslint.config.js`, `tsconfig.json`
- `vite.config.ts` (giữ SWC + Tailwind v4 plugin)

**Xóa/Thay thế:**
- `src/lib/api.ts` → XÓA (Axios)
- `src/features/*` (SpeakPing) → XÓA toàn bộ
- `src/stores/*` (SpeakPing) → XÓA, tạo mới auth-store + tenant-store

**Thêm mới:**
- `supabase/` folder toàn bộ
- `src/lib/supabase-browser.ts`, `supabase-types.ts`, `query-client.ts`, `permissions.ts`, `routes.ts`, `query-keys.ts`
- `src/stores/auth-store.ts`, `tenant-store.ts`
- `src/components/can.tsx` (implement sau ở Story 1.2 hoặc 1.6)
- `src/hooks/use-permissions.ts` (implement sau)

### MVP Restrictions (tuyệt đối không vi phạm)
- ❌ KHÔNG dùng Supabase Realtime
- ❌ KHÔNG dùng optimistic updates
- ❌ KHÔNG dùng barrel exports (`index.ts`)
- ❌ KHÔNG hardcode route paths — dùng `ROUTES`
- ❌ KHÔNG hardcode query key strings — dùng `QUERY_KEYS`
- ❌ KHÔNG `createClient()` lần 2
- ❌ KHÔNG `export default` cho components/functions
- ❌ KHÔNG dùng `clsx`/`twMerge` trực tiếp — dùng `cn()`
- ❌ KHÔNG dùng toast library khác ngoài Sonner

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Section "Phase 0 Checklist", "Supabase Setup Reference", "Shared Constants"
- Architecture: Section "Complete Project Tree" — đầy đủ project structure
- Architecture: Section "Enforcement Summary" — 15 rules bắt buộc
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.1 Acceptance Criteria
- Architecture: Section "Parallel Agent Execution Phases" — Phase 0 → 1a/1b → 1c flow

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 — 2026-03-23

### Debug Log References

- Build error: `@dnd-kit` packages bị xóa nhưng vẫn còn `draggable-data-table.tsx` dùng — đã thêm lại vào package.json
- Build error: Context files bị xóa (`theme-provider`, `layout-provider`, `search-provider`) — đã copy từ SpeakPing và tạo mới `search-provider` stub không có CommandMenu
- Build error: `profile-dropdown`, `sign-out-dialog`, `nav-user`, `top-nav`, `app-title` dùng SpeakPing API cũ — đã update sang Supabase auth-store API
- Build error: `routeTree.gen.ts` cũ/sai — run `vite dev` một lần để auto-generate đúng
- TypeScript strict: TanStack Router `Link` requires `search` param for unknown routes — replaced với `window.location.href` cho các routes chưa register trong routeTree

### Completion Notes List

- ✅ Project clone từ SpeakPing-Admin, rename to TekSpace, xóa SpeakPing features
- ✅ 13 migration files tạo đầy đủ theo đúng thứ tự, bao gồm `schedule_slot_changes` trong migration 06
- ✅ RLS policies file hoàn chỉnh với `current_tenant_id()` helper function
- ✅ Custom Access Token Hook embeds `tenant_roles: { tenantId: role }` vào JWT
- ✅ 4 pg_cron jobs với đúng thời gian ICT → UTC
- ✅ 4 Edge Function stubs (returns 200 OK) + 3 shared helpers
- ✅ `supabase-types.ts` placeholder hoàn chỉnh với tất cả tables/enums — cần regenerate sau `supabase db push`
- ✅ 5 frontend shared libs: `supabase-browser`, `query-client`, `permissions`, `routes`, `query-keys`
- ✅ 2 Zustand stores: `auth-store` (Supabase Auth) + `tenant-store` (JWT claims parsing)
- ✅ Base routes: `__root.tsx`, `sign-in.tsx` (placeholder), `_app/route.tsx` (auth guard stub)
- ✅ TypeScript compile: 0 errors; `npm run build` thành công (234 modules)
- ⚠️ MANUAL STEPS CẦN THỰC HIỆN SAU:
  1. Enable `pg_cron`, `pg_net` trong Supabase Dashboard
  2. Configure Auth (Site URL, Redirect URLs, disable email confirmation)
  3. Set `app.edge_function_url`, `app.service_role_key` trong DB settings
  4. `supabase db push` để apply migrations
  5. Enable Custom Access Token Hook trong Dashboard
  6. `supabase functions deploy` 4 edge functions
  7. Set Secrets: `RESEND_API_KEY`, `APP_URL`
  8. Regenerate types: `supabase gen types typescript --project-id <id> > src/lib/supabase-types.ts`
  9. Điền `.env` với URL và ANON_KEY thực tế

### File List

**Mới tạo:**
- `supabase/config.toml`
- `supabase/migrations/20260323000001_create_users.sql`
- `supabase/migrations/20260323000002_create_tenants.sql`
- `supabase/migrations/20260323000003_create_tenant_members.sql`
- `supabase/migrations/20260323000004_create_tenant_invites.sql`
- `supabase/migrations/20260323000005_create_schedule_weeks.sql`
- `supabase/migrations/20260323000006_create_schedule_slots.sql`
- `supabase/migrations/20260323000007_create_daily_reports.sql`
- `supabase/migrations/20260323000008_create_notifications.sql`
- `supabase/migrations/20260323000009_create_incidents.sql`
- `supabase/migrations/20260323000010_create_incident_appeals.sql`
- `supabase/migrations/20260323000011_rls_policies.sql`
- `supabase/migrations/20260323000012_custom_access_token_hook.sql`
- `supabase/migrations/20260323000013_pg_cron_jobs.sql`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/supabase-admin.ts`
- `supabase/functions/_shared/resend.ts`
- `supabase/functions/remove-member/index.ts`
- `supabase/functions/notify-schedule-change/index.ts`
- `supabase/functions/send-invite/index.ts`
- `supabase/functions/notify-schedule-reminder/index.ts`
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-types.ts` (placeholder — cần regenerate)
- `src/lib/query-client.ts`
- `src/lib/permissions.ts`
- `src/lib/routes.ts`
- `src/lib/query-keys.ts`
- `src/stores/auth-store.ts`
- `src/stores/tenant-store.ts`
- `src/routes/sign-in.tsx`
- `src/routes/_app/route.tsx`
- `src/context/theme-provider.tsx`
- `src/context/layout-provider.tsx`
- `src/context/search-provider.tsx`
- `src/features/auth/` (directory)
- `src/features/tenant/` (directory)
- `src/features/schedule/` (directory)
- `src/features/dashboard/` (directory)
- `src/features/daily-report/` (directory)
- `src/features/analytics/` (directory)
- `src/features/notifications/` (directory)
- `src/features/incidents/` (directory)
- `src/features/settings/` (directory)
- `.env.example`

**Chỉnh sửa:**
- `package.json` — name, deps (add supabase, remove axios, add dnd-kit back)
- `src/routes/__root.tsx` — QueryClientProvider + RouterContext (supabase)
- `src/main.tsx` — add supabase to router context
- `src/components/profile-dropdown.tsx` — new auth-store API
- `src/components/sign-out-dialog.tsx` — new auth-store API
- `src/components/layout/app-header.tsx` — removed ConfigDrawer
- `src/components/layout/app-title.tsx` — TekSpace branding
- `src/components/layout/nav-user.tsx` — new auth routes
- `src/components/layout/top-nav.tsx` — removed Link (type issue)
- `src/components/layout/data/sidebar-data.ts` — TekSpace navigation
- `.gitignore` — added `.env.local`, `.env.*.local`
- `.env` — updated for TekSpace Supabase vars

**Xóa:**
- `src/features/admin/` (SpeakPing)
- `src/features/auth/` (SpeakPing — replaced with TekSpace version)
- `src/features/analytics/` (SpeakPing — replaced)
- `src/features/dashboard/` (SpeakPing — replaced)
- `src/features/errors/` (SpeakPing)
- `src/features/faqs/` (SpeakPing)
- `src/features/notifications/` (SpeakPing — replaced)
- `src/features/questions/` (SpeakPing)
- `src/features/quotas/` (SpeakPing)
- `src/features/recordings/` (SpeakPing)
- `src/features/settings/` (SpeakPing — replaced)
- `src/features/subscriptions/` (SpeakPing)
- `src/features/users/` (SpeakPing)
- `src/features/versions/` (SpeakPing)
- `src/lib/api.ts` (Axios client)
- `src/components/config-drawer.tsx` (SpeakPing-specific)
- `src/components/command-menu.tsx` (SpeakPing-specific)
- `src/components/speakping-logo.tsx`

## Change Log

- 2026-03-23: Story implemented — Project setup từ SpeakPing-Admin, 13 migration files, RLS policies, Custom Access Token Hook, pg_cron jobs, 4 Edge Function stubs, Supabase TypeScript types (placeholder), 5 frontend shared libs, 2 Zustand stores, base routes. `npm run build` thành công (0 TypeScript errors). Manual Supabase Dashboard steps documented trong Completion Notes.
