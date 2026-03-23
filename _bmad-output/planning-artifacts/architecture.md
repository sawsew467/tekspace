---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-TekSpace-2026-03-23.md
  - SpeakPing-Admin FE Architecture (reference)
workflowType: 'architecture'
project_name: 'TekSpace'
user_name: 'Thắng'
date: '2026-03-23'
lastStep: 8
status: 'complete'
completedAt: '2026-03-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 52 FRs chia thành 9 nhóm chức năng

| Nhóm | FRs | Độ phức tạp |
|------|-----|------------|
| Account & Identity | FR1-5, FR50-51 | Medium |
| Tenant & Team Management | FR6-14, FR49 | Medium-High |
| Schedule Management | FR15-21 | High |
| Team Visibility & Dashboard | FR22-24 | Medium |
| Self-Visibility & Analytics | FR25-27 | Medium |
| Daily Report | FR28-32, FR52 | Medium |
| Hours Tracking & Analytics | FR33-37 | Medium |
| Notifications | FR38-43 | Medium-High |
| Incident Management | FR44-48 | Medium |

Nhóm phức tạp nhất:
- **Schedule Management (FR15-21):** multi-slot per day, overnight support,
  deadline lock, emergency override, recurring template từ tuần trước
- **Tenant & Team Management (FR6-14, FR49):** RBAC 3 roles per-tenant,
  invite lifecycle (48h expiry), session invalidation ngay lập tức, ownership transfer
- **Notifications (FR38-43):** 7 loại trigger khác nhau, dual delivery
  (in-app + email), kết hợp cron-based và event-driven

**Non-Functional Requirements:**

| NFR | Target | Ảnh hưởng kiến trúc |
|-----|--------|-------------------|
| FCP < 3s trên 4G | Performance | Code splitting, lazy loading per route |
| API response < 500ms p95 | Performance | Query optimization, RLS indexes |
| Dashboard render < 2s / 15 members | Performance | Efficient joins, React Query caching |
| Uptime ≥ 99% | Reliability | Supabase managed infra + VPS |
| RPO ≤ 24h, RTO ≤ 4h | Recovery | Supabase daily backup |
| Concurrent users ≥ 50 | Scale | Headroom cho multi-tenant phase 2 |
| Mobile core actions < 3 taps | UX | Responsive design, mobile-specific UI cho schedule |
| RLS tenant isolation | Security | Database-level enforcement bắt buộc |

**Scale & Complexity:**

- Primary domain: Full-stack SaaS B2B (HR Tech / Workforce Management)
- Complexity level: **Medium-High**
- Estimated architectural components: ~10 feature modules
- Development strategy: Schema-first → serial Phase 0 → parallel agents Phase 1a/1b

---

### Technical Constraints & Dependencies

- **Stack bắt buộc (từ PRD):** TanStack Start + Supabase + Resend + VPS
- **Timezone:** Lưu UTC tuyệt đối; schedule slots dùng `start_time (UTC) + duration_minutes`
  để tránh ambiguity khi qua midnight — không có ngoại lệ
- **Overnight slots:** slot kết thúc ngày hôm sau thuộc về ngày bắt đầu
  cho mục đích dashboard và hours calculation
- **Slot constraints:** min 30 phút, max 12 giờ, UI step 30 phút,
  overlap check tính trên UTC absolute time
- **Audit trail:** incidents, schedule changes, appeals là immutable inserts —
  không UPDATE, không DELETE bất cứ thứ gì
- **Hard-persist:** toàn bộ data dùng status/flag thay vì soft-delete
- **Notification engine:** Supabase `pg_cron` cho scheduled triggers (cron trong DB layer),
  Resend cho email delivery
- **Service role key:** chỉ dùng trong TanStack Start server functions,
  duy nhất cho `auth.admin.signOut()` khi remove member — không bao giờ expose client

---

### Cross-Cutting Concerns Identified

1. **Multi-tenancy** — `tenant_id` present trên tất cả data tables;
   `current_tenant_id()` helper function chuẩn hóa RLS policies;
   application layer validate thêm, không phải sole security boundary

2. **Timezone handling** — UTC storage mandatory everywhere;
   local display theo `users.timezone`; overnight slots cần special logic;
   schedule deadline notifications tính theo team timezone

3. **RBAC (Owner / Manager / Member)** — roles là per-tenant (1 user nhiều roles ở các tenant khác nhau);
   embed `{ tenantId: role }` map vào Supabase JWT via custom hook;
   ảnh hưởng đồng thời: route guards, UI visibility, RLS policies

4. **Permission checking pattern:**
   - **Route level:** TanStack Router `beforeLoad` → `throw redirect()`
   - **UI level:** `usePermissions()` semantic hook → `<Can>` component
   - **Data level:** Supabase RLS (source of truth)
   - **JWT:** Decode `tenant_roles` claim, không fetch DB thêm

5. **Audit trail** — incidents, schedule changes, appeals là append-only;
   không bao giờ UPDATE hoặc DELETE; immutable history bảo vệ cả 2 phía

6. **Real-time visibility** — "who is online" tính từ schedule_slots hiện tại
   (so sánh current UTC time với slots), không cần WebSocket cho MVP;
   Supabase Realtime subscribe schedule changes nếu cần live update

7. **Notification infrastructure** — 7 loại trigger; mỗi loại cần in-app + email;
   cron triggers qua `pg_cron`; event triggers qua Supabase Edge Functions

8. **Anonymous comparison** — self-dashboard hiển thị team average
   mà không expose data cá nhân; aggregate query server-side,
   không bao giờ trả về individual records

---

## Starter Template & Foundation

### Primary Technology Domain

Full-stack SaaS web application — React SPA frontend + Supabase backend,
deployed lên VPS (frontend) + Supabase Cloud (database/auth/functions).

### Quyết định kiến trúc: TanStack Router (không dùng TanStack Start)

**Lý do:**

SpeakPing-Admin đang dùng **TanStack Router** (SPA thuần), không phải TanStack Start.
TekSpace MVP chỉ có **1 operation cần server-side** (service role key): `removeMember`
→ `auth.admin.signOut(userId)`. Dùng TanStack Start cho 1 case này là over-engineered.

**Giải pháp:** Supabase Edge Functions xử lý toàn bộ server-side operations.

```
Client (TanStack Router SPA)
        ↓
Supabase Edge Function  ← service role key an toàn tại đây
        ↓
auth.admin.signOut(userId)
```

### Strategy: Clone SpeakPing-Admin + Adapt

Tái sử dụng SpeakPing-Admin làm base, thay thế các layer khác nhau:

**Giữ nguyên (reuse 100%):**
- `src/components/ui/` — 33 ShadcnUI components
- `src/components/data-table/` — headless table pattern
- `src/components/layout/` — Header, Sidebar, Main
- `src/hooks/` — use-debounce, use-dialog-state, use-mobile, use-table-url-state
- `src/lib/utils.ts`, `src/lib/cookies.ts`
- `src/styles/` — theme.css, index.css (Tailwind v4 + CSS variables)
- `.prettierrc`, `eslint.config.js`, `tsconfig.json`
- Build system: Vite + SWC, không thay đổi

**Thay thế:**
- `src/lib/api.ts` (Axios) → `src/lib/supabase-browser.ts` (Supabase anon key)
- Thêm: `src/lib/supabase-types.ts` (generated types từ Supabase CLI)
- `src/features/auth/` → Rewrite hoàn toàn với Supabase Auth
- `src/stores/auth-store.ts` → Zustand + Supabase session (không dùng localStorage token thủ công)
- Xóa toàn bộ features cũ của SpeakPing, tạo features mới của TekSpace

**Thêm mới:**
- `supabase/` folder (migrations, edge functions, seed)
- `src/lib/permissions.ts` — RBAC helpers
- `src/hooks/use-permissions.ts` — semantic permission hook
- `src/components/can.tsx` — permission component

### Tech Stack (Final)

| Layer | Technology | Version | Ghi chú |
|-------|-----------|---------|---------|
| Framework | React | 19 | |
| Language | TypeScript | ~5.9 | strict mode |
| Build | Vite + SWC | 7 | mirror SpeakPing |
| Routing | TanStack Router | 1.x | file-based, type-safe |
| Server State | TanStack React Query | 5.x | caching + mutations |
| Client State | Zustand | 5.x | auth + tenant context |
| UI Components | ShadcnUI + Radix UI | latest | copy-paste model |
| Styling | TailwindCSS v4 | 4.x | Vite plugin |
| Forms | React Hook Form + Zod | latest | |
| Icons | Lucide React | latest | |
| Database | Supabase (PostgreSQL) | cloud | RLS bắt buộc |
| Auth | Supabase Auth | cloud | JWT custom claims |
| Server-side ops | Supabase Edge Functions | Deno | service role only |
| Cron jobs | Supabase pg_cron | — | notification triggers |
| Email | Resend | — | transactional |
| Deployment | VPS (frontend) | — | static build |

### Initialization

```bash
# 1. Clone SpeakPing-Admin
cp -r SpeakPing-Admin tekspace && cd tekspace

# 2. Update package.json name + remove SpeakPing-specific deps
# Remove: axios (replaced by supabase-js)
# Add: @supabase/supabase-js, @supabase/ssr, jwt-decode

# 3. Supabase CLI setup
npm install -g supabase
supabase init  # tạo supabase/ folder
supabase login

# 4. Cleanup SpeakPing features
rm -rf src/features/recordings src/features/admin src/features/...

# 5. Tạo TekSpace feature structure
mkdir -p src/features/{schedule,dashboard,daily-report,analytics,notifications,incidents,settings,auth}
mkdir -p src/server  # Edge Functions được quản lý qua supabase/functions/
```

**Note:** Project initialization + Supabase setup là **Story đầu tiên trong Phase 0**
trước khi spawn parallel agents.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database schema + RLS phải hoàn thành trước khi spawn parallel agents
- Auth flow (Supabase Auth + JWT claims) phải serial-complete trong Phase 0
- Service layer pattern phải được document rõ cho agents follow

**Important Decisions (Shape Architecture):**
- Error handling standard đồng nhất
- Notification trigger architecture (pg_cron vs Edge Function)
- Permission model (JWT claims + usePermissions hook)

**Deferred Decisions (Post-MVP):**
- CI/CD pipeline (manual deploy trong MVP)
- Monitoring & alerting (Supabase dashboard đủ cho MVP)
- Performance optimization (sau khi có real usage data)

---

### Data Architecture

| Quyết định | Lựa chọn | Lý do |
|-----------|---------|-------|
| Database | Supabase PostgreSQL (cloud) | Managed, built-in auth, RLS, realtime |
| Multi-tenancy model | Shared schema + `tenant_id` + RLS | Đơn giản nhất, scale tốt, không cần separate DB |
| Timezone storage | UTC tuyệt đối cho mọi timestamp | Tránh ambiguity, hỗ trợ đa timezone |
| Schedule slot storage | `start_time (UTC) + duration_minutes` | Tránh end_time ambiguity khi qua midnight |
| Delete pattern | Hard-persist: status/flag, không soft-delete | Đảm bảo audit trail, data export tương lai |
| Audit trail | Append-only inserts cho incidents, schedule changes, appeals | Immutable history, bảo vệ cả 2 phía |
| Migration tool | Supabase CLI (`supabase db push`) | Official, version-controlled, CI-friendly |

---

### Authentication & Security

| Quyết định | Lựa chọn | Lý do |
|-----------|---------|-------|
| Auth provider | Supabase Auth | Built-in, tích hợp RLS seamlessly |
| Role storage | `tenant_members` table (user_id, tenant_id, role) | Per-tenant roles, 1 user nhiều roles |
| JWT custom claims | `tenant_roles: { tenantId: role }` map via Supabase hook | Tránh DB query thêm mỗi request |
| Service role | Supabase Edge Functions only | Không bao giờ expose client-side |
| RLS | Database-level enforcement (source of truth) | FE permission chỉ là UX layer |
| Permission pattern FE | `usePermissions()` semantic hook + `<Can>` component | Semantic, không check raw role trong component |
| Route guards | TanStack Router `beforeLoad` + `throw redirect()` | Type-safe, inherited by child routes |

---

### API & Communication Patterns

**Service Layer Pattern (mirror SpeakPing-Admin):**
```
Component / Page
      ↓
React Query hook (useQuery / useMutation)
      ↓
Service function (FeatureService.method)
      ↓
Supabase client (anon key + RLS)
```

**Error Handling Standard:**
```ts
// Service functions — throw on error (React Query catches)
export const ScheduleService = {
  getSlots: async (params) => {
    const { data, error } = await supabase.from('schedule_slots').select(...)
    if (error) throw error   // React Query onError handles
    return data
  }
}

// Global error handler — QueryCache.onError()
// 401 → redirect to sign-in
// 500 → toast "Có lỗi xảy ra, vui lòng thử lại"

// Local mutation errors — onError callback → toast cụ thể
useMutation({
  mutationFn: ScheduleService.upsertSlots,
  onError: (error) => toast.error('Không thể lưu lịch: ' + error.message),
})
```

**Supabase Edge Functions** — chỉ cho server-side operations:
- `remove-member` → `auth.admin.signOut(userId)` + update `tenant_members`
- Các event-driven notifications (schedule changed, invite sent)
- Gọi trực tiếp từ client qua `supabase.functions.invoke('function-name', { body })`

---

### Frontend Architecture

**State Management:**
| State type | Tool | Ví dụ |
|-----------|------|-------|
| Server state | React Query | schedules, reports, analytics |
| Auth session | Zustand (`useAuthStore`) | user, session |
| Tenant context | Zustand (`useTenantStore`) | activeTenantId, role |
| URL state | TanStack Router search params | filters, pagination |
| Local UI state | `useState` / `useReducer` | modal open, form step |

**Component Architecture:**
- Feature-based modules: `src/features/{feature}/`
- Mỗi feature có: `api/`, `hooks/`, `components/`, `schemas/`
- Shared UI: `src/components/ui/` (ShadcnUI)
- Shared layout: `src/components/layout/`
- Permission: `src/components/can.tsx`

**Code Splitting:**
- TanStack Router tự code-split theo route
- Lazy load heavy components (schedule grid, charts)

---

### Infrastructure & Deployment

| Quyết định | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Frontend hosting | VPS (static build) | `npm run build` → serve static files |
| Database | Supabase Cloud | Managed PostgreSQL |
| Edge Functions | Supabase Edge Functions (Deno) | Deploy cùng Supabase |
| Cron jobs | Supabase `pg_cron` | Chạy trong database layer |
| Email | Resend | Transactional, branded templates |
| CI/CD | Manual deploy (MVP) | Đơn giản, đủ dùng cho phase 1 |
| Monitoring | Supabase dashboard (MVP) | Query logs, auth events |

---

### Notification Trigger Architecture

**2 cơ chế:**

```
Time-based triggers → pg_cron (chạy trong Supabase DB)
Event-based triggers → Supabase Edge Functions
```

| Trigger | Cơ chế | Schedule/Event |
|---------|--------|----------------|
| Nhắc đăng ký lịch (trước deadline) | `pg_cron` | Chủ nhật 8PM team timezone |
| Auto-create empty schedule (sau deadline) | `pg_cron` | Chủ nhật 11:59PM team timezone |
| Nhắc submit daily report | `pg_cron` | Tối hàng ngày (configurable) |
| Deadline missed → notify member + manager | `pg_cron` | Sau deadline |
| Schedule changed → notify manager | Edge Function | DB trigger / client call |
| Member removed → session invalidate + notify | Edge Function | Client call trực tiếp |
| Invite sent | Edge Function | Client call trực tiếp |

**Notification delivery:** In-app (insert vào `notifications` table) + Email (Resend API call trong Edge Function / pg_cron job).

---

### Environment Configuration

```bash
# .env.local — tất cả environments
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...        # client-safe, prefix VITE_
VITE_APP_URL=http://localhost:3000

# Supabase Edge Functions environment (set qua Supabase Dashboard)
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # KHÔNG prefix VITE_, server-only
SUPABASE_DB_PASSWORD=                # migration only
RESEND_API_KEY=re_...                # email sending
```

---

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

25 vùng AI agents có thể quyết định khác nhau → gây incompatible code nếu không được specify.

---

### Naming Patterns

#### Database Naming Conventions

| Element | Convention | Ví dụ |
|---------|-----------|-------|
| Tables | `snake_case`, plural | `schedule_slots`, `tenant_members`, `daily_reports` |
| Columns | `snake_case` | `tenant_id`, `start_time`, `duration_minutes` |
| Foreign keys | `{table_singular}_id` | `user_id`, `tenant_id`, `slot_id` |
| Indexes | `idx_{table}_{column(s)}` | `idx_schedule_slots_tenant_id` |
| Functions | `snake_case` | `current_tenant_id()`, `is_tenant_member()` |
| RLS Policies | `{table}_{operation}_policy` | `schedule_slots_select_policy`, `tenant_members_insert_policy` |

**Rules:**
- KHÔNG dùng `camelCase` hay `PascalCase` trong database
- Primary key: `id uuid DEFAULT gen_random_uuid()`
- `tenant_id` luôn là cột thứ 2 (sau `id`) trong mọi data table
- Timestamps: `created_at`, `updated_at` — không dùng tên khác

#### File & Directory Naming Conventions

| Element | Convention | Ví dụ |
|---------|-----------|-------|
| Feature folders | `kebab-case` | `schedule/`, `daily-report/`, `hours-tracking/` |
| Component files | `PascalCase.tsx` | `ScheduleGrid.tsx`, `DailyReportForm.tsx` |
| Hook files | `use-kebab-case.ts` | `use-schedule-slots.ts`, `use-permissions.ts` |
| Service files | `{feature}.service.ts` | `schedule.service.ts`, `daily-report.service.ts` |
| Schema files | `{feature}.schema.ts` | `schedule-slot.schema.ts` |
| Type files | `{feature}.types.ts` | `schedule.types.ts` |

#### Code Naming Conventions

| Element | Convention | Ví dụ |
|---------|-----------|-------|
| Components | `PascalCase` | `ScheduleGrid`, `TeamDashboard` |
| Hooks | `camelCase`, bắt đầu `use` | `useScheduleSlots`, `usePermissions` |
| Service objects | `PascalCase` + `Service` suffix | `ScheduleService`, `DailyReportService` |
| Service methods | `camelCase`, verb-first | `getSlots`, `upsertSlots`, `submitReport` |
| Zustand stores | `camelCase` + `Store` | `useAuthStore`, `useTenantStore` |
| React Query keys | mảng strings, `kebab-case` | `['schedule-slots', tenantId, weekOf]` |
| Zod schemas | `camelCase` + `Schema` | `scheduleSlotSchema`, `dailyReportSchema` |
| TypeScript types | `PascalCase` | `ScheduleSlot`, `TenantMember`, `DailyReport` |
| Boolean variables | `is/has/can` prefix | `isLoading`, `hasPermission`, `canEdit` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleSlotChange` |
| Route paths | `kebab-case` | `/schedule`, `/daily-reports`, `/team-dashboard` |

---

### Structure Patterns

#### Feature Module Organization

Mỗi feature folder PHẢI có cấu trúc chuẩn sau:

```
src/features/{feature-name}/
├── services/
│   └── {feature}.service.ts    # Supabase queries thuần — không có React
├── components/
│   └── {ComponentName}.tsx     # Feature-specific components
├── hooks/
│   └── use-{feature}.ts        # React Query hooks + custom hooks
└── schemas/
    └── {feature}.schema.ts     # Zod schemas cho forms
```

**Rules:**
- `services/` chứa THUẦN service functions — không có React, không có hooks
- `hooks/` wrap `services/` với React Query (`useQuery`, `useMutation`)
- `components/` import từ `hooks/` — KHÔNG gọi `services/` trực tiếp từ component
- KHÔNG dùng barrel exports (`index.ts`) — import trực tiếp từ file

#### Shared Code Organization

```
src/
├── components/
│   ├── ui/              # ShadcnUI (không chỉnh sửa)
│   ├── layout/          # Header, Sidebar, Main
│   └── can.tsx          # Permission component
├── hooks/               # Shared hooks (use-debounce, use-mobile...)
├── lib/
│   ├── supabase-browser.ts   # Supabase client singleton
│   ├── supabase-types.ts     # Generated types — KHÔNG edit thủ công
│   ├── query-client.ts       # QueryClient + global error handler
│   ├── permissions.ts        # RBAC helpers + Permission types
│   ├── routes.ts             # ROUTES constant
│   ├── query-keys.ts         # QUERY_KEYS constant
│   └── utils.ts              # cn(), formatDate(), v.v.
└── stores/
    ├── auth-store.ts
    └── tenant-store.ts
```

---

### Shared Constants — Bắt buộc

#### src/lib/supabase-browser.ts — Singleton

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
// Agents LUÔN import { supabase } từ đây
// TUYỆT ĐỐI KHÔNG createClient() lần 2 ở bất kỳ file nào khác
```

#### src/lib/routes.ts

```typescript
export const ROUTES = {
  signIn: '/sign-in',
  app: {
    dashboard: '/dashboard',
    schedule: '/schedule',
    scheduleManage: '/schedule/manage',
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    settings: '/settings',
  }
} as const
// Agents PHẢI dùng ROUTES constant — KHÔNG hardcode path strings
```

#### src/lib/query-keys.ts

```typescript
export const QUERY_KEYS = {
  scheduleSlots: 'schedule-slots',
  tenantMembers: 'tenant-members',
  dailyReports: 'daily-reports',
  notifications: 'notifications',
  incidents: 'incidents',
  analytics: 'analytics',
} as const
// Agents PHẢI dùng QUERY_KEYS — KHÔNG hardcode query key strings
```

#### src/lib/permissions.ts

```typescript
export type Permission =
  | 'manageSchedule'      // Owner, Manager
  | 'viewTeamSchedule'    // All roles
  | 'approveSchedule'     // Owner, Manager
  | 'submitDailyReport'   // All roles
  | 'viewTeamDashboard'   // All roles
  | 'manageMembers'       // Owner
  | 'manageTenant'        // Owner
  | 'createIncident'      // Manager, Owner
  | 'viewAnalytics'       // All roles

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner:   ['manageSchedule', 'viewTeamSchedule', 'approveSchedule', 'submitDailyReport', 'viewTeamDashboard', 'manageMembers', 'manageTenant', 'createIncident', 'viewAnalytics'],
  manager: ['manageSchedule', 'viewTeamSchedule', 'approveSchedule', 'submitDailyReport', 'viewTeamDashboard', 'createIncident', 'viewAnalytics'],
  member:  ['viewTeamSchedule', 'submitDailyReport', 'viewTeamDashboard', 'viewAnalytics'],
}
// Agents PHẢI dùng Permission type này — KHÔNG tự define permission strings riêng
```

---

### Store Boundaries — Explicit

#### useAuthStore (auth-store.ts) chứa:

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
```

#### useTenantStore (tenant-store.ts) chứa:

```typescript
interface TenantState {
  activeTenantId: string | null
  activeRole: MemberRole | null
  tenants: TenantMember[]
  setActiveTenant: (tenantId: string) => void
}
// KHÔNG đặt auth/session data vào tenant store
```

---

### Format Patterns

#### Supabase Query — Service Pattern

```typescript
// ✅ ĐÚNG — named export, throw on error, return data trực tiếp
export const ScheduleService = {
  // select('*') — OK cho single-table queries
  getWeekSlots: async (tenantId: string, weekOf: string): Promise<ScheduleSlot[]> => {
    const { data, error } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('week_of', weekOf)
    if (error) throw error
    return data
  },

  // Explicit fields — bắt buộc khi có JOIN
  getWeekSlotsWithMember: async (tenantId: string, weekOf: string) => {
    const { data, error } = await supabase
      .from('schedule_slots')
      .select('id, tenant_id, start_time, duration_minutes, users(id, full_name, avatar_url)')
      .eq('tenant_id', tenantId)
      .eq('week_of', weekOf)
    if (error) throw error
    return data
  }
}

// ❌ SAI — return error object
export const getSlots = async (...) => {
  try { ... return { success: true, data } }
  catch { return { success: false, error } }
}
```

**Rule:** `select('*')` = OK cho single-table. Explicit fields = bắt buộc khi JOIN.

#### Edge Function — Service Pattern

```typescript
// Edge Function calls PHẢI nằm trong services/ — không gọi trực tiếp từ component/hook
export const MemberService = {
  removeMember: async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('remove-member', {
      body: { userId }
    })
    if (error) throw error
    return data
  }
}
// KHÔNG gọi supabase.functions.invoke() trực tiếp từ component hay hook
```

#### React Query Key Convention

```typescript
// Pattern: [QUERY_KEYS.feature, ...identifiers, filters?]
queryKey: [QUERY_KEYS.scheduleSlots, tenantId, weekOf]
queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, date }]
queryKey: [QUERY_KEYS.notifications, userId, { unreadOnly: true }]
```

#### Cache Invalidation

```typescript
// Prefix invalidation (default) — invalidate tất cả queries của feature
queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots] })

// Exact invalidation — khi cần target specific query
queryClient.invalidateQueries({
  queryKey: [QUERY_KEYS.scheduleSlots, tenantId, weekOf],
  exact: true
})
```

#### Date/Time Formats

```typescript
// Storage (Supabase): UTC ISO string
"2026-03-23T14:00:00Z"

// API params — date-only
"2026-03-23"

// Display — luôn convert UTC → user.timezone
import { toZonedTime, format } from 'date-fns-tz'

// ❌ Forbidden
new Date().toLocaleDateString()  // không timezone-aware
```

#### TypeScript Types

```typescript
// Dùng generated types từ supabase-types.ts
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase-types'
type ScheduleSlot = Tables<'schedule_slots'>
type NewScheduleSlot = TablesInsert<'schedule_slots'>

// Extend khi cần
type ScheduleSlotWithMember = ScheduleSlot & {
  users: Pick<Tables<'users'>, 'id' | 'full_name' | 'avatar_url'>
}

// KHÔNG tự define manual type nếu đã có trong generated types
```

---

### Component Patterns

#### className — chỉ dùng cn()

```typescript
import { cn } from '@/lib/utils'
// ✅ Đúng
<div className={cn('base-class', condition && 'extra', className)} />
// ❌ Sai — không dùng clsx() hay twMerge() trực tiếp
```

#### Toast — chỉ dùng Sonner

```typescript
import { toast } from 'sonner'
toast.success('Đã lưu lịch')
toast.error('Không thể lưu: ' + error.message)
// ❌ Sai — không import react-hot-toast, react-toastify, hay lib khác
```

#### Component Export — Named only

```typescript
// ✅ Đúng
export function ScheduleGrid() {}
export const ScheduleGrid = () => {}

// ❌ Sai
export default function ScheduleGrid() {}
```

---

### Process Patterns

#### Loading States

```typescript
// Initial load → Skeleton
const { data, isLoading } = useQuery(...)
if (isLoading) return <ScheduleGridSkeleton />

// Mutation → isPending + disabled fieldset (toàn bộ form)
const { mutate, isPending } = useMutation(...)
<Form {...form}>
  <fieldset disabled={isPending}>
    <FormField ... />
    <Button type="submit">
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Lưu lịch
    </Button>
  </fieldset>
</Form>
```

#### Error Handling Hierarchy

```
Level 1: Global — src/lib/query-client.ts QueryCache.onError
  → 401 Unauthorized → redirect(ROUTES.signIn)
  → Unhandled errors → toast.error('Có lỗi xảy ra, vui lòng thử lại')

Level 2: Mutation-specific — useMutation onError
  → toast.error với message cụ thể theo context

Level 3: Form validation — Zod + React Hook Form
  → Inline error messages dưới field — KHÔNG toast

Level 4: Error boundaries — crash-level only
  → Fallback UI, không toast
```

#### Permission Pattern

```typescript
// ✅ Semantic hook
const { canManageSchedule } = usePermissions()

// ✅ Can component
<Can do="manageSchedule"><EditButton /></Can>

// ✅ Route guard
beforeLoad: ({ context }) => {
  if (!context.permissions.canManageSchedule)
    throw redirect({ to: ROUTES.app.schedule })
}

// ❌ Raw role check — không bao giờ dùng
if (role === 'manager') ...
```

#### MVP Restrictions

- ❌ KHÔNG dùng Supabase Realtime — dùng `refetchInterval` nếu cần polling
- ❌ KHÔNG dùng optimistic updates — dùng `isPending` state thay thế
- ❌ KHÔNG dùng barrel exports (`index.ts`) — import trực tiếp từ file
- ❌ KHÔNG hardcode route paths — dùng `ROUTES` constant
- ❌ KHÔNG hardcode query key strings — dùng `QUERY_KEYS` constant
- ❌ KHÔNG `createClient()` lần 2 — import `supabase` từ `supabase-browser.ts`

---

### Phase 0 Checklist — Serial Setup

> Toàn bộ items dưới đây PHẢI hoàn thành trước khi spawn parallel agents

**Supabase:**
- [ ] Auth: Site URL + Redirect URLs configured
- [ ] Auth: Email confirmation disabled
- [ ] Custom Access Token Hook: `custom_access_token_hook` function + enabled
- [ ] Extensions: `pg_cron`, `pg_net` enabled
- [ ] `app.edge_function_url` + `app.service_role_key` DB settings
- [ ] Database schema migrations (tất cả tables)
- [ ] RLS policies cho tất cả tables
- [ ] pg_cron jobs scheduled (4 jobs)
- [ ] Edge Function: `remove-member` deployed
- [ ] Secrets: `RESEND_API_KEY`, `APP_URL`

**Frontend Foundation:**
- [ ] Clone SpeakPing-Admin + cleanup SpeakPing features
- [ ] `tsconfig.json` paths alias `@/*`
- [ ] `src/lib/supabase-browser.ts` (singleton client)
- [ ] `src/lib/supabase-types.ts` (generated từ CLI)
- [ ] `src/lib/query-client.ts` (global error handler)
- [ ] `src/lib/permissions.ts` (đầy đủ Permission types + ROLE_PERMISSIONS)
- [ ] `src/lib/routes.ts` (ROUTES constant)
- [ ] `src/lib/query-keys.ts` (QUERY_KEYS constant)
- [ ] `src/stores/auth-store.ts` (interface + implementation)
- [ ] `src/stores/tenant-store.ts` (interface + implementation)
- [ ] `src/routes/_app.tsx` (layout + auth guard)
- [ ] `src/routes/sign-in.tsx` (auth flow hoàn chỉnh)

---

### Supabase Setup Reference

#### Custom Access Token Hook

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

Enable tại: **Authentication → Hooks → Custom Access Token**.

#### app.settings cho pg_cron

```sql
ALTER DATABASE postgres SET app.edge_function_url = 'https://xxx.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = 'eyJ...';
```

#### pg_cron Jobs

| Job | Schedule | Mục đích |
|-----|----------|---------|
| `remind-schedule-submission` | `0 13 * * 0` | Chủ nhật 8PM ICT — nhắc đăng ký lịch |
| `auto-create-empty-schedule` | `59 16 * * 0` | Chủ nhật 11:59PM ICT — tạo schedule trống |
| `remind-daily-report` | `0 12 * * *` | Hàng ngày — nhắc submit report |
| `deadline-missed-notify` | `5 13 * * 0` | Sau deadline — notify member + manager |

---

### Enforcement Summary

**All AI Agents MUST:**
- Đặt `tenant_id` là cột thứ 2 trong mọi data table migration
- Đặt tên RLS policy theo `{table}_{operation}_policy`
- Throw error trong service functions — không return error object
- Named exports only — không `export default`
- Import DB types từ `supabase-types.ts` — không tự define
- Dùng `cn()` cho className — không `clsx`/`twMerge` trực tiếp
- Dùng `toast` từ `sonner` — không lib khác
- Disable toàn bộ `<fieldset>` khi form submitting
- Wrap permission checks qua `usePermissions()` — không check raw role
- `select('*')` cho single-table; explicit fields khi JOIN
- Đặt Edge Function calls trong `services/` — không gọi trực tiếp từ component
- Import `supabase` singleton — không `createClient()` lần 2
- Dùng `ROUTES` constant — không hardcode paths
- Dùng `QUERY_KEYS` constant — không hardcode strings
- Dùng `Permission` type từ `permissions.ts` — không tự define strings

---

## Project Structure & Boundaries

### FR Groups → Feature Mapping

| FR Group | Feature Folder |
|----------|---------------|
| Account & Identity (FR1-5, FR50-51) | `src/features/auth/` |
| Tenant & Team Management (FR6-14, FR49) | `src/features/tenant/` |
| Schedule Management (FR15-21) | `src/features/schedule/` |
| Team Visibility & Dashboard (FR22-24) | `src/features/dashboard/` |
| Self-Visibility & Analytics (FR25-27) | `src/features/analytics/` |
| Daily Report (FR28-32, FR52) | `src/features/daily-report/` |
| Hours Tracking (FR33-37) | `src/features/analytics/` ← **merge vào analytics**, không tách riêng |
| Notifications (FR38-43) | `src/features/notifications/` |
| Incident Management (FR44-48) | `src/features/incidents/` |

> **Note:** Hours Tracking (FR33-37) và Self-Visibility Analytics (FR25-27) dùng chung data source (`schedule_slots`, `daily_reports`) → merge vào `features/analytics/`. Agents KHÔNG tạo `features/hours-tracking/` riêng.

---

### Complete Project Tree

```
tekspace/
├── .env.local
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── tsconfig.json
├── vite.config.ts
├── package.json
├── index.html
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/
│   │   ├── 20260323000001_create_users.sql
│   │   ├── 20260323000002_create_tenants.sql
│   │   ├── 20260323000003_create_tenant_members.sql
│   │   ├── 20260323000004_create_tenant_invites.sql
│   │   ├── 20260323000005_create_schedule_weeks.sql
│   │   ├── 20260323000006_create_schedule_slots.sql
│   │   ├── 20260323000007_create_daily_reports.sql
│   │   ├── 20260323000008_create_notifications.sql
│   │   ├── 20260323000009_create_incidents.sql
│   │   ├── 20260323000010_create_incident_appeals.sql
│   │   ├── 20260323000011_rls_policies.sql
│   │   ├── 20260323000012_custom_access_token_hook.sql
│   │   └── 20260323000013_pg_cron_jobs.sql
│   └── functions/
│       ├── remove-member/
│       │   └── index.ts
│       ├── notify-schedule-change/
│       │   └── index.ts
│       ├── send-invite/
│       │   └── index.ts
│       ├── notify-schedule-reminder/
│       │   └── index.ts
│       └── _shared/
│           ├── supabase-admin.ts     # service role client
│           ├── resend.ts             # email helper
│           └── cors.ts               # CORS headers — dùng chung mọi functions
│
└── src/
    ├── main.tsx
    ├── routeTree.gen.ts              # auto-generated bởi TanStack Router
    │
    ├── styles/
    │   ├── index.css
    │   └── theme.css                 # Tailwind v4 CSS variables
    │
    ├── components/
    │   ├── ui/                       # ShadcnUI — không chỉnh sửa
    │   │   ├── button.tsx
    │   │   ├── dialog.tsx
    │   │   ├── form.tsx
    │   │   ├── input.tsx
    │   │   ├── select.tsx
    │   │   ├── table.tsx
    │   │   ├── sonner.tsx
    │   │   └── ...
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── SidebarNav.tsx
    │   │   └── Main.tsx
    │   ├── data-table/               # Headless table pattern từ SpeakPing
    │   │   ├── DataTable.tsx
    │   │   ├── DataTableToolbar.tsx
    │   │   └── DataTablePagination.tsx
    │   └── can.tsx                   # <Can do="permission"> component
    │
    ├── hooks/
    │   ├── use-debounce.ts
    │   ├── use-dialog-state.ts
    │   ├── use-mobile.ts
    │   ├── use-table-url-state.ts
    │   └── use-permissions.ts
    │
    ├── lib/
    │   ├── supabase-browser.ts       # singleton client — import duy nhất
    │   ├── supabase-types.ts         # generated — không edit thủ công
    │   ├── query-client.ts           # QueryClient + global error handler
    │   ├── permissions.ts            # Permission types + ROLE_PERMISSIONS
    │   ├── routes.ts                 # ROUTES constant
    │   ├── query-keys.ts             # QUERY_KEYS constant
    │   ├── utils.ts                  # cn(), formatDate(), formatUTC()
    │   └── cookies.ts
    │
    ├── stores/
    │   ├── auth-store.ts             # user, session
    │   └── tenant-store.ts           # activeTenantId, activeRole
    │
    ├── routes/
    │   ├── __root.tsx                # Providers: QueryClientProvider, RouterContext, Toaster(Sonner)
    │   ├── sign-in.tsx               # /sign-in
    │   ├── accept-invite.tsx         # /accept-invite?token=xxx → gọi tenant.service.ts
    │   └── _app/
    │       ├── route.tsx             # Layout: auth guard (redirect /sign-in nếu no session)
    │       │                         #         + Sidebar + Header + <Outlet />
    │       ├── dashboard.tsx         # /dashboard (FR22-24)
    │       ├── schedule/
    │       │   ├── index.tsx         # /schedule — member view (FR15, FR22)
    │       │   └── manage.tsx        # /schedule/manage — manager+ only (FR16-21)
    │       ├── daily-report.tsx      # /daily-report (FR28-32, FR52)
    │       ├── analytics.tsx         # /analytics (FR25-27, FR33-37)
    │       ├── notifications.tsx     # /notifications (FR38-43)
    │       ├── incidents/
    │       │   ├── index.tsx         # /incidents list (FR44-48)
    │       │   └── $incidentId.tsx   # /incidents/:id — detail + appeal
    │       └── settings/
    │           ├── route.tsx         # /settings layout
    │           ├── profile.tsx       # /settings/profile (FR1-5, FR50-51)
    │           └── team.tsx          # /settings/team — owner only (FR6-14, FR49)
    │
    └── features/
        ├── auth/
        │   ├── services/
        │   │   └── auth.service.ts           # signIn, signOut, getSession
        │   ├── hooks/
        │   │   └── use-auth.ts               # useSignIn, useSignOut
        │   ├── components/
        │   │   └── SignInForm.tsx
        │   └── schemas/
        │       └── auth.schema.ts
        │
        ├── tenant/                           # FR6-14, FR49
        │   ├── services/
        │   │   └── tenant.service.ts         # getMembers, inviteMember, removeMember
        │   │                                 # acceptInvite, transferOwnership
        │   ├── hooks/
        │   │   ├── use-tenant-members.ts
        │   │   ├── use-invite-member.ts
        │   │   └── use-remove-member.ts      # gọi Edge Function remove-member
        │   ├── components/
        │   │   ├── MemberList.tsx
        │   │   ├── InviteMemberDialog.tsx
        │   │   ├── RemoveMemberDialog.tsx
        │   │   └── TransferOwnershipDialog.tsx
        │   └── schemas/
        │       └── tenant.schema.ts
        │
        ├── schedule/                         # FR15-21
        │   ├── services/
        │   │   └── schedule.service.ts       # getWeekSlots, upsertSlots
        │   │                                 # approveRequest, emergencyOverride
        │   ├── hooks/
        │   │   ├── use-schedule-slots.ts
        │   │   ├── use-upsert-slots.ts
        │   │   └── use-approve-request.ts
        │   ├── components/
        │   │   ├── ScheduleGrid.tsx
        │   │   ├── SlotForm.tsx
        │   │   ├── ScheduleDeadlineBadge.tsx
        │   │   ├── TeamScheduleView.tsx
        │   │   └── EmergencyOverrideDialog.tsx
        │   └── schemas/
        │       └── schedule.schema.ts        # slotSchema (start_time, duration_minutes)
        │
        ├── dashboard/                        # FR22-24
        │   ├── services/
        │   │   └── dashboard.service.ts      # getTeamStatus, getOnlineNow
        │   ├── hooks/
        │   │   └── use-team-dashboard.ts
        │   └── components/
        │       ├── TeamDashboard.tsx
        │       ├── MemberStatusCard.tsx
        │       └── OnlineNowBadge.tsx
        │
        ├── daily-report/                     # FR28-32, FR52
        │   ├── services/
        │   │   └── daily-report.service.ts   # getReport, submitReport, getTeamReports
        │   ├── hooks/
        │   │   ├── use-daily-report.ts
        │   │   └── use-submit-report.ts
        │   ├── components/
        │   │   ├── DailyReportForm.tsx
        │   │   ├── ReportStatusBadge.tsx
        │   │   └── TeamReportList.tsx
        │   └── schemas/
        │       └── daily-report.schema.ts
        │
        ├── analytics/                        # FR25-27 + FR33-37 (merged)
        │   ├── services/
        │   │   └── analytics.service.ts      # getOwnHours, getOwnAttendance
        │   │                                 # getTeamAggregate (anonymous, server-side only)
        │   ├── hooks/
        │   │   ├── use-own-analytics.ts
        │   │   └── use-team-aggregate.ts
        │   └── components/
        │       ├── HoursChart.tsx
        │       ├── AttendanceCalendar.tsx
        │       └── TeamComparisonWidget.tsx  # hiển thị aggregate, không expose cá nhân
        │
        ├── notifications/                    # FR38-43
        │   ├── services/
        │   │   └── notification.service.ts   # getNotifications, markAsRead, markAllRead
        │   ├── hooks/
        │   │   ├── use-notifications.ts      # refetchInterval: 30_000
        │   │   └── use-mark-read.ts
        │   └── components/
        │       ├── NotificationBell.tsx      # badge số unread trên Header
        │       ├── NotificationList.tsx
        │       └── NotificationItem.tsx
        │
        ├── incidents/                        # FR44-48
        │   ├── services/
        │   │   └── incident.service.ts       # createIncident, getIncidents, submitAppeal
        │   ├── hooks/
        │   │   ├── use-incidents.ts
        │   │   ├── use-create-incident.ts
        │   │   └── use-submit-appeal.ts
        │   ├── components/
        │   │   ├── IncidentList.tsx
        │   │   ├── IncidentDetail.tsx
        │   │   ├── CreateIncidentDialog.tsx
        │   │   └── AppealForm.tsx
        │   └── schemas/
        │       └── incident.schema.ts
        │
        └── settings/                         # FR1-5, FR49-51
            ├── services/
            │   └── settings.service.ts       # updateProfile, updateTimezone, deleteAccount
            ├── hooks/
            │   └── use-update-profile.ts
            ├── components/
            │   ├── ProfileForm.tsx
            │   ├── TimezoneSelector.tsx
            │   └── DeleteAccountDialog.tsx
            └── schemas/
                └── settings.schema.ts
```

---

### Architectural Boundaries

#### Data Flow

```
User Action
  → Route (routes/_app/*)
  → Feature Component (features/*/components/*)
  → Feature Hook (features/*/hooks/*)
  → Feature Service (features/*/services/*.service.ts)
  → supabase singleton (lib/supabase-browser.ts)
  → Supabase DB (RLS enforced)
```

#### Security Boundaries

```
Client (anon key + RLS)
  → lib/supabase-browser.ts
  → features/*/services/*.service.ts    ← tất cả read/write thông thường

Edge Function (service role)            ← chỉ khi cần bypass RLS
  → supabase/functions/_shared/supabase-admin.ts
  → auth.admin.signOut()                ← remove-member
  → Resend API                          ← email delivery

pg_cron (service role trong DB)         ← scheduled notifications
  → Edge Functions via pg_net
```

#### Integration Points

| External Service | Tích hợp tại | Auth |
|-----------------|-------------|------|
| Supabase Auth | `lib/supabase-browser.ts` + `stores/auth-store.ts` | anon key |
| Supabase DB | `features/*/services/*.service.ts` | anon key + RLS |
| Supabase Edge Functions | `features/*/services/*.service.ts` | anon key |
| Resend | `supabase/functions/_shared/resend.ts` | RESEND_API_KEY (server-only) |

---

### Database Ownership Map

| Table | Feature owner | Được đọc bởi |
|-------|--------------|-------------|
| `users` | auth/ | tất cả (read name/avatar) |
| `tenants` | tenant/ | auth/ (tenant context) |
| `tenant_members` | tenant/ | auth/ (JWT hook), tất cả (permission) |
| `tenant_invites` | tenant/ | — |
| `schedule_weeks` | schedule/ | notifications/ (deadline) |
| `schedule_slots` | schedule/ | dashboard/, analytics/ |
| `daily_reports` | daily-report/ | analytics/ |
| `notifications` | notifications/ | pg_cron (insert) |
| `incidents` | incidents/ | — |
| `incident_appeals` | incidents/ | — |

---

### Parallel Agent Execution Phases

```
Phase 0 — Serial (1 agent, phải xong trước tất cả):
├── Supabase: migrations, RLS, JWT hook, pg_cron, Edge Functions
├── Frontend foundation: supabase-browser, query-client, stores,
│   permissions, routes, query-keys
├── features/auth/ (sign-in flow)
├── features/tenant/ core (member list, invite, remove)
└── routes/_app/route.tsx (layout + auth guard)

Phase 1a — Parallel Group A (có thể chạy song song):
├── Agent A1: features/schedule/ + routes/_app/schedule/
├── Agent A2: features/daily-report/ + routes/_app/daily-report.tsx
└── Agent A3: features/analytics/ + routes/_app/analytics.tsx

Phase 1b — Parallel Group B (có thể chạy song song với 1a):
├── Agent B1: features/notifications/ + routes/_app/notifications.tsx
├── Agent B2: features/incidents/ + routes/_app/incidents/
└── Agent B3: features/settings/ + routes/_app/settings/

Phase 1c — Sau khi 1a + 1b xong:
└── features/dashboard/ (cần schedule + notifications data)
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

| Check | Result |
|-------|--------|
| TanStack Router ↔ React Query ↔ Zustand | ✅ Compatible, không conflict |
| Supabase Auth ↔ JWT custom claims ↔ RLS | ✅ Custom hook inject claims, RLS là source of truth |
| Vite + SWC ↔ TailwindCSS v4 | ✅ Vite plugin cho Tailwind v4 |
| Edge Functions (Deno) ↔ Resend ↔ pg_cron | ✅ Luồng rõ ràng, không overlap |
| SpeakPing clone strategy ↔ tech stack mới | ✅ Thay Axios → supabase-js, giữ nguyên UI layer |

**Pattern Consistency:** ✅ snake_case DB / PascalCase components / kebab-case files — nhất quán toàn document.

**Structure Alignment:** ✅ Feature folders mirror FR groups, routes mirror features, migration files cover tất cả tables.

---

### Requirements Coverage Validation ✅

**52 Functional Requirements:**

| FR Group | FRs | Covered by | Status |
|----------|-----|-----------|--------|
| Account & Identity | FR1-5, FR50-51 | `features/auth/`, `features/settings/` | ✅ |
| Tenant & Team Management | FR6-14, FR49 | `features/tenant/`, Edge Function `remove-member` | ✅ |
| Schedule Management | FR15-21 | `features/schedule/`, `schedule_weeks` + `schedule_slots` | ✅ |
| Team Visibility & Dashboard | FR22-24 | `features/dashboard/` | ✅ |
| Self-Visibility & Analytics | FR25-27 | `features/analytics/` | ✅ |
| Daily Report | FR28-32, FR52 | `features/daily-report/` | ✅ |
| Hours Tracking | FR33-37 | `features/analytics/` (merged) | ✅ |
| Notifications | FR38-43 | `features/notifications/`, pg_cron + Edge Functions | ✅ |
| Incident Management | FR44-48 | `features/incidents/`, `incident_appeals` table | ✅ |

**8 Non-Functional Requirements:**

| NFR | Giải pháp kiến trúc | Status |
|-----|-------------------|--------|
| FCP < 3s trên 4G | TanStack Router code-split theo route | ✅ |
| API < 500ms p95 | RLS indexes, React Query caching | ✅ |
| Dashboard < 2s / 15 members | Aggregate query server-side | ✅ |
| Uptime ≥ 99% | Supabase managed + VPS static | ✅ |
| RPO ≤ 24h, RTO ≤ 4h | Supabase daily backup | ✅ |
| Concurrent ≥ 50 users | Supabase connection pooling, stateless FE | ✅ |
| Mobile < 3 taps | Responsive ShadcnUI, `useIsMobile()` hook cho adaptive layout | ✅ |
| RLS tenant isolation | RLS trên mọi table + `current_tenant_id()` | ✅ |

---

### Implementation Readiness Validation ✅

| Criteria | Status |
|----------|--------|
| Tech stack với versions | ✅ React 19, Vite 7, TanStack Router 1.x, Zustand 5.x |
| Patterns với code examples | ✅ Service, Query, Mutation, Form, Permission |
| Naming conventions đầy đủ | ✅ DB, file, code — có ví dụ cụ thể |
| Shared constants | ✅ ROUTES, QUERY_KEYS, Permission types |
| Store interfaces | ✅ AuthState, TenantState explicit |
| Supabase setup checklist | ✅ 22 items Phase 0 |
| Parallel execution phases | ✅ Phase 0 → 1a/1b → 1c |
| Edge Function patterns | ✅ `_shared/` helpers, CORS, error handling |

---

### Gap Analysis Results

**Critical Gaps:** Không có ❌

**Important — Addressed in document:**

**1 — `schedule_weeks` table role:**

```
schedule_weeks: 1 row per tenant per week
Columns: id, tenant_id, week_of (date), deadline (timestamptz), is_locked (bool)
Role: tracking deadline và lock state cho schedule submission
Logic: is_locked = true → members không thể edit slots
       pg_cron check deadline → set is_locked = true sau cutoff
schedule_slots.week_id FK → schedule_weeks.id
```

Đây là core của FR17 (deadline lock) và trigger cho notification nhắc submit lịch.

**2 — Mobile pattern:**

```typescript
// useIsMobile() hook (từ SpeakPing, giữ nguyên)
// ScheduleGrid.tsx: dùng useIsMobile() để switch layout
// Desktop: grid view (7 columns per week)
// Mobile (< 768px): list view theo ngày
```

**3 — Skeleton naming convention:**

```
Co-located trong cùng components/ folder:
ScheduleGrid.tsx → ScheduleGridSkeleton.tsx
TeamDashboard.tsx → TeamDashboardSkeleton.tsx
```

**Nice-to-Have (deferred):** Deployment nginx config, local dev workflow (`supabase start`) — defer post-MVP.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] 52 FRs phân tích, 9 nhóm identified
- [x] 8 NFRs mapped to architectural solutions
- [x] Scale complexity: Medium-High
- [x] 7 cross-cutting concerns documented

**✅ Core Architectural Decisions**
- [x] Stack với versions
- [x] SpeakPing clone strategy
- [x] Multi-tenancy: shared schema + RLS
- [x] Auth + JWT custom claims
- [x] Notification architecture: pg_cron + Edge Functions
- [x] Environment config

**✅ Implementation Patterns (25 items)**
- [x] Naming conventions: DB, file, code
- [x] Service/Hook/Component layer separation
- [x] Shared constants: ROUTES, QUERY_KEYS, permissions
- [x] Store boundaries: auth vs tenant
- [x] Error handling hierarchy: 4 levels
- [x] MVP restrictions
- [x] Phase 0 checklist: 22 items
- [x] Supabase setup reference

**✅ Project Structure**
- [x] Complete project tree
- [x] FR → feature folder mapping
- [x] Parallel agent phases: 0 → 1a/1b → 1c
- [x] Database ownership map
- [x] Security boundaries
- [x] Integration points

---

### Architecture Readiness Assessment

**Overall Status: ✅ READY FOR IMPLEMENTATION**

**Confidence Level: HIGH**

**Key Strengths:**
- 25 conflict points identified và resolved → agents viết compatible code
- Phase 0 → 1a/1b → 1c plan → safe parallel execution
- SpeakPing clone strategy → giảm setup time đáng kể
- Permission model nhất quán 3 layers: JWT claims + RLS + usePermissions()
- Supabase setup checklist đủ để không miss bất kỳ config nào

**Deferred Post-MVP:**
- CI/CD pipeline
- Monitoring & alerting
- Supabase Realtime
- Performance optimization sau khi có real usage data

---

### Implementation Handoff

**AI Agent Guidelines:**
- Đọc `supabase/migrations/` trước khi implement bất kỳ feature nào để nắm schema chi tiết
- Follow tất cả architectural decisions trong document này
- Dùng implementation patterns nhất quán — không tự quyết khi đã có spec
- Respect project structure và boundaries
- Refer document này cho mọi câu hỏi kiến trúc

**First Implementation Priority:**
```bash
# Phase 0 — Story đầu tiên:
# 1. Clone SpeakPing-Admin + cleanup
# 2. supabase init + migrations
# 3. Frontend foundation files
# 4. features/auth/ + features/tenant/ core
# 5. routes/_app/route.tsx (auth guard)
# → Xong Phase 0 → spawn parallel agents Phase 1a/1b
```
