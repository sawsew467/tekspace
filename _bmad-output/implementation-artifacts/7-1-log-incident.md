# Story 7.1: Log Incident

**Status:** review
**Epic:** 7 — Incident Management
**Story ID:** 7.1
**Story Key:** 7-1-log-incident
**Created:** 2026-03-25

---

## Story

As a Manager or Owner,
I want to formally log incidents for team members with categories and notes,
So that there is an official, objective record of performance issues or policy violations.

---

## Acceptance Criteria

**Given** Manager/Owner đang ở Incidents page
**When** Manager click "Log Incident"
**Then** hiển thị dialog: chọn member (dropdown danh sách active members, loại trừ bản thân), chọn category (4 loại: Late Schedule, Missed Report, Low Commitment, Policy Violation), nhập ghi chú (bắt buộc, textarea), nút Confirm

**Given** Manager submit incident form hợp lệ
**When** submit thành công
**Then** incident được INSERT vào DB với: member_id, manager_id (= auth.uid()), tenant_id, category, note, created_at
**And** incident là immutable — không có UPDATE hay DELETE operation nào được phép
**And** member nhận in-app notification type `incident_logged`: "Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents." với `link_to: '/incidents'`
**And** dialog đóng, incident list tự cập nhật

**Given** Manager cố gắng edit hoặc delete một incident đã log
**When** họ thực hiện action đó
**Then** hệ thống không cho phép — không có edit/delete button nào tồn tại trong UI

**Given** Member truy cập `/incidents`
**When** page load
**Then** member chỉ thấy incidents được log cho chính mình (RLS xử lý tự động)
**And** member không thấy "Log Incident" button (permission guard)

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Không cần migration

Tất cả DB schema đã tồn tại:

| Thành phần | Migration | Trạng thái |
|-----------|-----------|-----------|
| `incidents` table + RLS | 20260323000009 + 000011 | ✅ Đã có |
| `incident_appeals` table + RLS | 20260323000010 + 000011 | ✅ Đã có (dùng cho Story 7-2) |
| `notification_type` enum (`incident_logged`, `appeal_submitted`, `appeal_reviewed`) | 20260323000008 | ✅ Đã có |
| `notifications` table + RLS | 20260323000008 + 000011 | ✅ Đã có |
| `incident_category` enum | 20260323000009 | ✅ Đã có |

### DB Schema incidents table

```sql
CREATE TABLE public.incidents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.users(id),
  manager_id  uuid NOT NULL REFERENCES public.users(id),
  category    public.incident_category NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incidents_no_self_report CHECK (member_id <> manager_id)
  -- KHÔNG có updated_at — immutable
);
```

**incident_category enum:** `late_schedule | missed_report | low_commitment | policy_violation`

### RLS Policies đã active

- **incidents SELECT:** `tenant_id = current_tenant_id() AND (member_id = auth.uid() OR is_tenant_manager())`
  → Manager thấy tất cả; member chỉ thấy incidents của mình ✅
- **incidents INSERT:** `tenant_id = current_tenant_id() AND manager_id = auth.uid() AND is_tenant_manager() AND member phải là active member trong tenant`
  → RLS tự enforce; client KHÔNG cần validate thêm ✅
- **notifications INSERT:** `tenant_id = current_tenant_id()`
  → Bất kỳ authenticated user nào trong tenant đều có thể INSERT ✅ (manager INSERT notification cho member)

### Notification flow — CLIENT-SIDE (không cần Edge Function)

Sau khi INSERT incident thành công, INSERT ngay notification cho member trong cùng một service method:

```typescript
// Trong createIncident():
await supabase.from('notifications').insert({
  tenant_id: data.tenantId,
  user_id: data.memberId,       // member nhận notification
  type: 'incident_logged',
  message: 'Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents.',
  link_to: '/incidents',
})
```

**Lý do không dùng Edge Function:** Story 6-2 đã establish pattern: event-based notifications cho incident/appeal được INSERT trực tiếp từ client (không phải pg_cron trigger). Patterns từ Story 4-3 và 6-1 confirm client-side INSERT cho notifications là chuẩn.

### Sidebar đã có "Incidents"

`src/components/layout/data/sidebar-data.ts` đã có entry:
```typescript
{ title: 'Incidents', url: '/incidents' }
```
**KHÔNG cần sửa sidebar.**

### Permission đã sẵn

`usePermissions()` đã export `canCreateIncident` (owner + manager).
`<Can do="createIncident">` component đã có.
**KHÔNG cần sửa permissions.ts.**

### ROUTES và QUERY_KEYS đã có

```typescript
ROUTES.app.incidents = '/incidents'         // routes.ts
QUERY_KEYS.incidents = 'incidents'          // query-keys.ts
QUERY_KEYS.incidentAppeals = 'incident-appeals'  // query-keys.ts (dùng Story 7-2)
```

### Supabase Types đã generated

```typescript
import type { Tables, Enums } from '@/lib/supabase-types'
type Incident = Tables<'incidents'>
type IncidentCategory = Enums<'incident_category'>
```

**KHÔNG chạy `supabase gen types` — file đã up-to-date.**

### Member list để populate select

Reuse `getMembers` từ `src/features/tenant/services/tenant.service.ts`:
```typescript
export const getMembers = async (tenantId: string): Promise<TenantMemberWithUser[]>
```
- Trả về active members với `users(id, full_name, avatar_url, timezone, email)`
- Filter trong UI: loại trừ `user.id === currentUserId` (không tự log incident cho mình — DB constraint cũng enforce `member_id <> manager_id`)
- **KHÔNG viết lại query này — import trực tiếp**

### Không có $incidentId.tsx trong Story 7-1

Architecture có `routes/_app/incidents/$incidentId.tsx` nhưng story này KHÔNG tạo detail page.
- Story 7-2 sẽ tạo member view (xem chi tiết + appeal)
- Story 7-3 sẽ tạo audit trail view cho manager
- Story 7-1 chỉ cần `incidents/index.tsx`

---

## Cấu trúc file cần tạo

```
src/
├── features/incidents/              # Folder đã tồn tại (empty)
│   ├── schemas/
│   │   └── incident.schema.ts       # Zod schema cho create form
│   ├── services/
│   │   └── incident.service.ts      # createIncident, getIncidents
│   ├── hooks/
│   │   ├── use-incidents.ts         # useQuery list
│   │   └── use-create-incident.ts   # useMutation
│   └── components/
│       ├── IncidentList.tsx          # Danh sách incidents (empty state + cards)
│       └── CreateIncidentDialog.tsx  # Dialog log incident
│
└── routes/_app/incidents/
    └── index.tsx                    # /incidents page
```

**KHÔNG tạo:** `$incidentId.tsx` (Story 7-2), barrel `index.ts` (anti-pattern của project)

---

## Tasks / Subtasks

### Task 1: Schema — `src/features/incidents/schemas/incident.schema.ts`

```typescript
import { z } from 'zod'

export const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  late_schedule:    'Đăng ký lịch trễ',
  missed_report:    'Bỏ lỡ Daily Report',
  low_commitment:   'Cam kết giờ thấp',
  policy_violation: 'Vi phạm quy định',
}

export const createIncidentSchema = z.object({
  memberId: z.string().uuid('Vui lòng chọn thành viên'),
  category: z.enum(['late_schedule', 'missed_report', 'low_commitment', 'policy_violation'], {
    required_error: 'Vui lòng chọn loại incident',
  }),
  note: z.string().min(1, 'Ghi chú là bắt buộc').max(2000, 'Ghi chú tối đa 2000 ký tự'),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
```

### Task 2: Service — `src/features/incidents/services/incident.service.ts`

```typescript
import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type Incident = Tables<'incidents'>

export const IncidentService = {
  getIncidents: async (tenantId: string): Promise<Incident[]> => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  createIncident: async (params: {
    tenantId: string
    memberId: string
    managerId: string
    category: string
    note: string
  }): Promise<Incident> => {
    // INSERT incident
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .insert({
        tenant_id:  params.tenantId,
        member_id:  params.memberId,
        manager_id: params.managerId,
        category:   params.category as any,
        note:       params.note,
      })
      .select()
      .single()
    if (incidentError) throw incidentError

    // INSERT notification cho member — client-side, không cần Edge Function
    await supabase.from('notifications').insert({
      tenant_id: params.tenantId,
      user_id:   params.memberId,
      type:      'incident_logged',
      message:   'Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents.',
      link_to:   '/incidents',
    })
    // Bỏ qua lỗi notification — incident đã được tạo thành công

    return incident
  },
}
```

**Lưu ý quan trọng:**
- `createIncident` là append-only INSERT — KHÔNG có update/delete method nào
- Notification INSERT sau incident INSERT — nếu notification fail thì incident vẫn valid (try/catch nếu cần, nhưng bỏ qua lỗi notification là acceptable)
- `managerId` truyền vào từ `user.id` (auth store) — client KHÔNG query lại

### Task 3: Hooks

**`src/features/incidents/hooks/use-incidents.ts`**
```typescript
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useIncidents(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidents, tenantId],
    queryFn: () => IncidentService.getIncidents(tenantId!),
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  })
}
```

**`src/features/incidents/hooks/use-create-incident.ts`**
- Pattern: `useMutation` + `queryClient.invalidateQueries` on settled
- `onSuccess`: toast.success('Incident đã được ghi nhận')
- `onError`: toast.error('Không thể ghi nhận incident')
- `onSettled`: invalidate `[QUERY_KEYS.incidents, tenantId]`
- **KHÔNG dùng optimistic update** (append-only data, không có rollback pattern hợp lý)

### Task 4: Component — `CreateIncidentDialog.tsx`

Props: `{ open, onOpenChange, tenantId, currentUserId }`

Structure:
- Dùng `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` từ shadcn/ui
- Form với `react-hook-form` + `zodResolver(createIncidentSchema)`
- **Member Select:** fetch members với `useQuery([QUERY_KEYS.tenantMembers, tenantId], () => getMembers(tenantId!))`, filter bỏ `currentUserId`, hiển thị `users.full_name`
- **Category Select:** dùng `Select` shadcn/ui với 4 option từ `INCIDENT_CATEGORY_LABELS`
- **Note:** `Textarea` với placeholder "Mô tả sự cố, hành vi vi phạm..."
- Submit: gọi `createIncident.mutate({ tenantId, memberId, managerId: currentUserId, category, note })`
- Disable submit button khi `createIncident.isPending`
- Close dialog sau `onSuccess`

**Validation UX:**
- Form error hiển thị inline dưới mỗi field
- Không submit khi form invalid (zodResolver handle)

### Task 5: Component — `IncidentList.tsx`

Props: `{ incidents: Incident[], isLoading: boolean, members: TenantMemberWithUser[] }`

- Loading: `Skeleton` cards
- Empty state: icon + "Chưa có incident nào được ghi nhận."
- Mỗi incident card hiển thị:
  - Badge category (dùng `INCIDENT_CATEGORY_LABELS`)
  - Member name (join từ `members` array theo `member_id`)
  - Manager name (join theo `manager_id`)
  - Ghi chú (truncate nếu dài, tooltip full text)
  - Ngày tạo (format `dd/MM/yyyy HH:mm` theo user timezone)
- **Không có** edit/delete button — immutable append-only

### Task 6: Route — `src/routes/_app/incidents/index.tsx`

```typescript
export const Route = createFileRoute('/_app/incidents/')({
  head: () => ({ meta: [{ title: 'Incidents — TekSpace' }] }),
  component: IncidentsPage,
})
```

Component `IncidentsPage`:
- `useAuthStore()` → `user`
- `useTenantStore()` → `activeTenantId`
- `usePermissions()` → `canCreateIncident`
- `useIncidents(activeTenantId)` → incidents list
- `useQuery([QUERY_KEYS.tenantMembers, activeTenantId], () => getMembers(activeTenantId!))` → members (để resolve names trong IncidentList)
- State: `dialogOpen` boolean
- Layout:
  ```
  <div class="container max-w-3xl py-6 space-y-4">
    <header: title "Incidents" + <Can do="createIncident"><Button onClick={() => setDialogOpen(true)}>Log Incident</Button></Can>>
    <IncidentList incidents={incidents} isLoading={isLoading} members={members} />
    <Can do="createIncident">
      <CreateIncidentDialog open={dialogOpen} onOpenChange={setDialogOpen} tenantId={activeTenantId} currentUserId={user?.id} />
    </Can>
  </div>
  ```

---

## Patterns tham khảo từ codebase

| Pattern | File tham khảo |
|---------|---------------|
| Service pattern | `src/features/notifications/services/notifications.service.ts` |
| useQuery hook | `src/features/notifications/hooks/use-notifications.ts` |
| useMutation + invalidate | `src/features/notifications/hooks/use-mark-read.ts` |
| Route component | `src/routes/_app/notifications.tsx` |
| Can component usage | `src/routes/_app/schedule.tsx` hoặc `settings/` |
| Member list fetch + reuse | `src/features/tenant/services/tenant.service.ts:getMembers()` |
| Dialog với react-hook-form | Tham khảo `src/features/tenant/components/InviteMemberDialog.tsx` (nếu có) |
| Timezone date format | `src/features/notifications/components/NotificationItem.tsx` (formatDistanceToNow + toZonedTime) |

---

## Anti-patterns cần tránh

- ❌ KHÔNG tạo `UPDATE` hoặc `DELETE` operation trên `incidents` hoặc `incident_appeals`
- ❌ KHÔNG hardcode query key strings — dùng `QUERY_KEYS.incidents`
- ❌ KHÔNG hardcode route paths — dùng `ROUTES.app.incidents`
- ❌ KHÔNG `createClient()` lần 2 — import `supabase` từ `@/lib/supabase-browser`
- ❌ KHÔNG tạo `index.ts` barrel exports — import trực tiếp từ file
- ❌ KHÔNG dùng optimistic update cho incident list (append-only, không cần rollback)
- ❌ KHÔNG check role bằng string so sánh — dùng `usePermissions().canCreateIncident`
- ❌ KHÔNG fetch members bằng query mới — reuse `getMembers` từ `tenant.service.ts`
- ❌ KHÔNG tạo `$incidentId.tsx` trong story này (Story 7-2)

---

## Kiểm tra sau khi implement

- [ ] Manager thấy "Log Incident" button, member KHÔNG thấy
- [ ] Form validation: member required, category required, note required
- [ ] DB constraint `member_id <> manager_id` — thử chọn chính mình (bị blocked bởi UI filter)
- [ ] Sau submit: incident xuất hiện trong list không cần refresh
- [ ] Member nhận notification type `incident_logged` sau khi incident được log
- [ ] RLS: member chỉ thấy incidents của mình; manager thấy tất cả
- [ ] Không có edit/delete button nào trong UI
- [ ] `npx supabase test db` phải PASS (không có migration mới, test suite cũ vẫn giữ nguyên)

---

## Dev Notes

### Deviation quan trọng: Notification qua Edge Function thay vì client-side

Story plan ban đầu ghi notification INSERT trực tiếp từ client. Thực tế không thể làm vậy vì `notifications_insert_policy` có điều kiện ẩn: GoTrue enforce `user_id = auth.uid()` khi client insert — manager không thể INSERT notification cho member khác từ browser.

**Fix:** Tạo Edge Function `supabase/functions/notify-incident/index.ts` dùng service role để bypass RLS:
- Nhận `{ incidentId, tenantId, memberId }` từ client
- Verify JWT (manager phải là owner/manager của tenant)
- INSERT notification với service role client

`incident.service.ts` gọi `supabase.functions.invoke('notify-incident', ...)` sau khi INSERT incident thành công.

### Files tạo mới

| File | Mô tả |
|------|-------|
| `src/features/incidents/schemas/incident.schema.ts` | Zod schema + `INCIDENT_CATEGORY_LABELS` |
| `src/features/incidents/services/incident.service.ts` | `getIncidents`, `createIncident` (gọi Edge Function cho notification) |
| `src/features/incidents/hooks/use-incidents.ts` | useQuery với `refetchOnMount: 'always'` |
| `src/features/incidents/hooks/use-create-incident.ts` | useMutation, invalidate on settled |
| `src/features/incidents/components/IncidentList.tsx` | Danh sách incidents, empty state, skeleton |
| `src/features/incidents/components/CreateIncidentDialog.tsx` | Dialog với react-hook-form + zodResolver |
| `src/routes/_app/incidents/index.tsx` | Route `/incidents` |
| `supabase/functions/notify-incident/index.ts` | Edge Function gửi notification (ngoài plan gốc) |

### Files modified ngoài incidents feature

| File | Thay đổi |
|------|---------|
| `src/features/notifications/hooks/use-notifications-realtime.ts` | Thêm invalidate `QUERY_KEYS.incidents` khi nhận `incident_logged` notification → incidents list tự cập nhật realtime khi đang ở trang |

### Lưu ý cho Story 7-2

- `incident_appeals` table + RLS đã sẵn (migration 00010 + 00011)
- Pattern notification cho Story 7-2 (`appeal_submitted` → Manager nhận): cần Edge Function tương tự `notify-incident` vì cùng vấn đề RLS (member INSERT notification cho manager)
- Cân nhắc tạo 1 Edge Function chung `notify-incident-event` thay vì tạo riêng mỗi story
