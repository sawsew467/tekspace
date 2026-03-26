# Story 9.3: Incident Lifecycle — Dismiss/Uphold

Status: done
Epic: 9 — Product Quality & Feature Completion
Story Key: 9-3-incident-lifecycle-dismiss-uphold
Created: 2026-03-26

---

## Story

Là một Manager,
tôi muốn chính thức resolve incident là "dismissed" hoặc "upheld" sau khi đã xem xét appeal,
để có outcome rõ ràng và violation stats của member phản ánh đúng thực tế.

---

## Acceptance Criteria

**Given** Manager xem một incident ở trạng thái pending (chưa có resolution record)
**When** Manager click "Resolve Incident"
**Then** Manager thấy 2 options: "Bỏ qua vi phạm" (Dismiss) / "Giữ nguyên vi phạm" (Uphold)
**And** resolution note là optional

**Given** Manager submit resolution
**When** submit thành công
**Then** `incident_resolutions` record được INSERT (không UPDATE incident gốc — immutable)
**And** incident hiển thị status: Dismissed hoặc Upheld với note và timestamp
**And** member nhận in-app notification về kết quả resolution

**Given** Member xem incident đã được resolve
**When** member xem detail
**Then** member thấy: outcome (Dismissed/Upheld) + resolution note của Manager
**And** nếu Upheld → violation count tăng trong violation summary của member

**Given** Manager xem Team Incidents page
**When** filter theo status
**Then** có thể filter: All / Pending / Dismissed / Upheld
**And** Pending = incidents chưa có resolution record

**Given** incident đã được resolve
**When** Manager cố resolve lại
**Then** UI không cho phép — resolve button bị disabled/ẩn

---

## Tasks / Subtasks

- [ ] **Task 1:** DB Migration — bảng `incident_resolutions` + RLS (AC: #1, #2, #3, #4, #5)
  - [ ] Tạo file `supabase/migrations/20260326000001_create_incident_resolutions.sql`
  - [ ] CREATE TABLE với UNIQUE(incident_id), RLS ON
  - [ ] Helper function `is_incident_resolver()` với SECURITY DEFINER nếu cần
  - [ ] SELECT policy: manager thấy tất cả trong tenant; member chỉ thấy resolution của incidents của mình (dùng `is_incident_victim()` đã có)
  - [ ] INSERT policy: chỉ manager/owner, `resolved_by = auth.uid()`, `tenant_id = current_tenant_id()`
  - [ ] Chạy `npx supabase db push --local` để apply
  - [ ] Verify bằng MCP: `get_table_schema('public.incident_resolutions')`

- [ ] **Task 2:** Service layer — thêm methods vào `incident.service.ts` (AC: #2, #3)
  - [ ] Thêm type `IncidentResolution = Tables<'incident_resolutions'>` vào service exports
  - [ ] Thêm `getResolutions(tenantId: string): Promise<IncidentResolution[]>` — query tất cả resolutions trong tenant, order by `resolved_at DESC`
  - [ ] Thêm `createResolution(params)` — INSERT + gọi `notify-resolution` Edge Function (best-effort pattern)

- [ ] **Task 3:** Zod schema — `src/features/incidents/schemas/resolution.schema.ts` (AC: #2)
  - [ ] `createResolutionSchema` với fields: `outcome` (enum: 'dismissed'|'upheld'), `note` (optional, max 2000)
  - [ ] Export `RESOLUTION_OUTCOME_LABELS` và `RESOLUTION_OUTCOME_BADGE_VARIANT`

- [ ] **Task 4:** TanStack Query hooks (AC: #2, #4)
  - [ ] `src/features/incidents/hooks/use-resolutions.ts` — `useResolutions(tenantId)` với staleTime 30s
  - [ ] `src/features/incidents/hooks/use-create-resolution.ts` — `useCreateResolution(tenantId)` với invalidateQueries cả `incidents` lẫn `incidentResolutions`
  - [ ] Thêm `incidentResolutions: 'incident-resolutions'` vào `src/lib/query-keys.ts`

- [ ] **Task 5:** Edge Function `notify-resolution` (AC: #3)
  - [ ] Tạo `supabase/functions/notify-resolution/index.ts` — theo pattern của `notify-incident/index.ts`
  - [ ] Params: `{ tenantId, memberId, incidentId, outcome }` — 4 fields bắt buộc
  - [ ] Verify: caller là manager/owner, incident thuộc tenant
  - [ ] INSERT notification cho member: type `'incident_resolved'`, message khác nhau cho dismissed vs upheld
  - [ ] `link_to: '/incidents'`

- [ ] **Task 6:** Component `ResolveIncidentDialog.tsx` (AC: #1, #2)
  - [ ] Tạo `src/features/incidents/components/ResolveIncidentDialog.tsx`
  - [ ] Dialog có 2 radio buttons: "Bỏ qua vi phạm (Dismiss)" / "Giữ nguyên vi phạm (Uphold)"
  - [ ] Textarea cho resolution note (optional, max 2000)
  - [ ] Submit gọi `useCreateResolution` mutation
  - [ ] `onSuccess`: toast.success + đóng dialog
  - [ ] Props: `{ open, onOpenChange, incidentId, tenantId, memberId, resolvedBy }`

- [ ] **Task 7:** Cập nhật `src/routes/_app/incidents/$incidentId.tsx` (AC: #2, #3, #5)
  - [ ] Import `useResolutions` — reuse cached data từ `/incidents` page qua query key chung
  - [ ] Tìm resolution cho incident hiện tại: `resolutions.find(r => r.incident_id === incidentId)`
  - [ ] Thêm section "Kết quả xử lý" (Resolution Section):
    - Nếu đã resolve: hiển thị outcome badge + note + timestamp + resolved_by name
    - Nếu chưa resolve + canCreateIncident: hiển thị "Resolve Incident" button → mở `ResolveIncidentDialog`
  - [ ] Button disabled khi đã có resolution (AC: #5)
  - [ ] Member view: nếu Upheld → hiển thị "Incident này đã xác nhận vi phạm" cảnh báo

- [ ] **Task 8:** Cập nhật `src/routes/_app/incidents/index.tsx` — filter theo resolution status (AC: #4)
  - [ ] Load `useResolutions(activeTenantId)` — thêm vào page (cùng với appeals)
  - [ ] Thêm state `filterResolutionStatus: ''` (All / 'pending' / 'dismissed' / 'upheld')
  - [ ] Cập nhật `filteredIncidents` useMemo: filter theo resolution outcome
  - [ ] Cập nhật `IncidentFilters` props để nhận `filterResolutionStatus` + handler
  - [ ] Pass `resolutions` vào `IncidentList` để hiển thị status badge

- [ ] **Task 9:** Cập nhật `IncidentFilters` component — thêm resolution status filter (AC: #4)
  - [ ] Thêm Select dropdown: "Tất cả" / "Pending" / "Dismissed" / "Upheld"
  - [ ] Cập nhật `onReset` để reset `filterResolutionStatus` về `''`

- [ ] **Task 10:** Cập nhật `IncidentList` component — hiển thị resolution status badge (AC: #2, #4)
  - [ ] Nhận prop `resolutions: IncidentResolution[]`
  - [ ] Với mỗi incident, tìm resolution → hiển thị badge status:
    - Không có resolution: badge "Pending" (outline)
    - `dismissed`: badge "Dismissed" (secondary)
    - `upheld`: badge "Upheld" (destructive)

- [ ] **Task 11:** DB tests + RLS verification (AC: tất cả)
  - [ ] Chạy `npx supabase test db` — tất cả phải PASS
  - [ ] Test RLS inline qua MCP: member chỉ thấy resolution của incident của mình
  - [ ] Test: manager thấy tất cả resolutions trong tenant
  - [ ] Test: UNIQUE constraint ngăn duplicate resolution cho cùng incident_id

---

## Dev Notes

### Architecture: Append-Only `incident_resolutions`

Bảng `incident_resolutions` là **third tier** của incident lifecycle:

```
Tier 1: incidents (Manager logs — append-only)
         ↓ [notify-incident]
Tier 2: incident_appeals (Member appeals — max 1 per incident, append-only)
         ↓ [notify-appeal]
Tier 3: incident_outcome_notes (Manager notes — append-only, nhiều record)
         ↓ [notify-outcome-note]
Tier NEW: incident_resolutions (Manager resolves — MAX 1 per incident via UNIQUE constraint)
         ↓ [notify-resolution — MỚI]
```

**Immutability rule:** KHÔNG bao giờ UPDATE hay DELETE bất kỳ record nào. Resolution chỉ INSERT 1 lần duy nhất (đảm bảo bởi UNIQUE constraint).

### DB Migration File

**Tên file:** `supabase/migrations/20260326000001_create_incident_resolutions.sql`

> Dùng timestamp naming theo A4 từ retro — đảm bảo thứ tự migration đúng.
> Dùng `20260326000001` (không dùng `_incident_resolutions` — chỉ dùng số).

**Schema chính xác** (từ sprint-change-proposal-2026-03-26.md):

```sql
CREATE TABLE public.incident_resolutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE RESTRICT,
  outcome     TEXT NOT NULL CHECK (outcome IN ('dismissed', 'upheld')),
  note        TEXT,
  resolved_by UUID NOT NULL REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
  -- KHÔNG có updated_at — immutable, không bao giờ UPDATE
);

CREATE INDEX idx_incident_resolutions_tenant_id   ON public.incident_resolutions(tenant_id);
CREATE INDEX idx_incident_resolutions_incident_id ON public.incident_resolutions(incident_id);

ALTER TABLE public.incident_resolutions ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**

```sql
-- SELECT: Manager/Owner thấy tất cả trong tenant
--         Member chỉ thấy resolution của incident mà mình là victim
-- Dùng is_incident_victim() đã tồn tại (SECURITY DEFINER) — KHÔNG viết lại
CREATE POLICY incident_resolutions_select_policy ON public.incident_resolutions
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_manager()
      OR public.is_incident_victim(incident_id)  -- SECURITY DEFINER → safe, no recursion
    )
  );

-- INSERT: Chỉ manager/owner, resolved_by = auth.uid()
CREATE POLICY incident_resolutions_insert_policy ON public.incident_resolutions
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND resolved_by = auth.uid()
    AND public.is_tenant_manager()
  );
```

> ⚠️ **KHÔNG viết lại** `is_incident_victim()` — hàm này đã tồn tại trong migration `20260325000009_create_incident_outcome_notes.sql`. Chỉ gọi nó.

### Service Layer: Thêm vào `incident.service.ts`

**QUAN TRỌNG:** Thêm vào file `src/features/incidents/services/incident.service.ts` hiện có — **KHÔNG tạo file service mới**.

```typescript
// Thêm vào đầu file (sau các type hiện có)
export type IncidentResolution = Tables<'incident_resolutions'>

// Thêm vào IncidentService object:
getResolutions: async (tenantId: string): Promise<IncidentResolution[]> => {
  const { data, error } = await supabase
    .from('incident_resolutions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('resolved_at', { ascending: false })
  if (error) throw error
  return data ?? []
},

createResolution: async (params: {
  tenantId:    string
  incidentId:  string
  memberId:    string   // member của incident — để Edge Function INSERT notification
  resolvedBy:  string
  outcome:     'dismissed' | 'upheld'
  note?:       string
}): Promise<IncidentResolution> => {
  // INSERT resolution — append-only, UNIQUE constraint enforce 1 resolution per incident
  const { data: resolution, error: resolutionError } = await supabase
    .from('incident_resolutions')
    .insert({
      tenant_id:   params.tenantId,
      incident_id: params.incidentId,
      outcome:     params.outcome,
      note:        params.note ?? null,
      resolved_by: params.resolvedBy,
    })
    .select()
    .single()
  if (resolutionError) throw resolutionError

  // Notify member qua Edge Function — best-effort
  try {
    await supabase.functions.invoke('notify-resolution', {
      body: {
        tenantId:   params.tenantId,
        memberId:   params.memberId,
        incidentId: params.incidentId,
        outcome:    params.outcome,
      },
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[createResolution] notification failed (best-effort):', err)
  }

  return resolution
},
```

### Hooks

**`use-resolutions.ts`** — pattern giống `use-incidents.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useResolutions(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentResolutions, tenantId],
    queryFn: () => IncidentService.getResolutions(tenantId!),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    enabled: !!tenantId,
  })
}
```

**`use-create-resolution.ts`** — pattern giống `use-create-incident.ts`:

```typescript
// onSettled: invalidate CẢ incidents lẫn incidentResolutions
// Lý do: incidents list cần re-render badge status sau khi resolve
queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.incidents, tenantId] })
queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.incidentResolutions, tenantId] })
```

**Query Key** — thêm vào `src/lib/query-keys.ts`:

```typescript
incidentResolutions: 'incident-resolutions',  // Story 9.3
```

### Edge Function `notify-resolution`

**File:** `supabase/functions/notify-resolution/index.ts`

Theo **đúng pattern** của `notify-incident/index.ts`:

```typescript
// Params body: { tenantId, memberId, incidentId, outcome }
// Verify: caller là manager/owner của tenant
// Verify: incident thuộc tenant và memberId khớp
// INSERT notification cho member:
{
  tenant_id: tenantId,
  user_id:   memberId,
  type:      'incident_resolved',
  message:   outcome === 'upheld'
    ? '⚠️ Incident của bạn đã được xử lý: Vi phạm được giữ nguyên.'
    : '✅ Incident của bạn đã được xử lý: Vi phạm đã được bỏ qua.',
  link_to:   '/incidents',
}
```

> **Auth pattern:** Dùng `getUserFromJwt()` (KHÔNG dùng `supabaseAdmin.auth.getUser()` — gây JWT issuer mismatch trong local dev → timeout).

### Component `ResolveIncidentDialog.tsx`

Đặt tại: `src/features/incidents/components/ResolveIncidentDialog.tsx`

Pattern: giống `CreateIncidentDialog.tsx` và `AppealDialog.tsx` hiện có.

```typescript
// Dùng: Dialog + RadioGroup (shadcn) + Textarea + Button
// outcome: RadioGroup với 2 options rõ ràng (không dùng Select)
// note: optional Textarea, max 2000, hint text "optional"
// Submit: useCreateResolution mutation
// onSuccess: toast.success('Incident đã được resolve') + onOpenChange(false)
// onError: toast.error('Không thể resolve incident')

interface ResolveIncidentDialogProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  incidentId:    string
  tenantId:      string | null
  memberId:      string      // member của incident (để notify)
  resolvedBy:    string      // user.id của Manager đang resolve
}
```

### Cập nhật Incidents List Page (`index.tsx`)

**Thêm resolutions query:**

```typescript
const { data: resolutions = [] } = useResolutions(activeTenantId)
```

**Thêm filter state:**

```typescript
const [filterResolutionStatus, setFilterResolutionStatus] = useState<'' | 'pending' | 'dismissed' | 'upheld'>('')
```

**Cập nhật `filteredIncidents` useMemo — thêm resolution filter:**

```typescript
if (filterResolutionStatus) {
  const hasResolution = resolutions.some(r => r.incident_id === incident.id)
  if (filterResolutionStatus === 'pending'   && hasResolution) return false
  if (filterResolutionStatus === 'dismissed' && !resolutions.some(r => r.incident_id === incident.id && r.outcome === 'dismissed')) return false
  if (filterResolutionStatus === 'upheld'    && !resolutions.some(r => r.incident_id === incident.id && r.outcome === 'upheld')) return false
}
```

**Pass resolutions xuống `IncidentList`:**

```typescript
<IncidentList
  // ... props hiện có ...
  resolutions={resolutions}
/>
```

**Reset filter:** Thêm `setFilterResolutionStatus('')` vào `handleResetFilters`.

### Cập nhật Detail Page (`$incidentId.tsx`)

**Thêm resolutions query:**

```typescript
const { data: resolutions = [] } = useResolutions(activeTenantId)
const resolution = resolutions.find((r) => r.incident_id === incidentId)
```

**Thêm state cho resolve dialog:**

```typescript
const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
```

**Thêm Section 4: Resolution** (sau Section 3 Outcome Notes):

```typescript
<Card>
  <CardHeader className='pb-3'>
    <CardTitle className='text-base'>Kết quả xử lý</CardTitle>
  </CardHeader>
  <CardContent>
    {resolution ? (
      // Hiển thị outcome + note + timestamp + resolved_by
      // Outcome badges: Dismissed (secondary) / Upheld (destructive)
    ) : (
      // Chưa resolve
      canCreateIncident && (
        <Button variant='outline' size='sm' onClick={() => setResolveDialogOpen(true)}>
          Resolve Incident
        </Button>
      )
    )}
    {/* Member view: cảnh báo nếu Upheld */}
    {resolution?.outcome === 'upheld' && !canCreateIncident && (
      <p className='text-sm text-destructive mt-2'>
        ⚠️ Incident này đã xác nhận vi phạm và được tính vào hồ sơ của bạn.
      </p>
    )}
  </CardContent>
</Card>

{/* ResolveIncidentDialog — chỉ manager */}
{canCreateIncident && incident && (
  <ResolveIncidentDialog
    open={resolveDialogOpen}
    onOpenChange={setResolveDialogOpen}
    incidentId={incidentId}
    tenantId={activeTenantId}
    memberId={incident.member_id}
    resolvedBy={user!.id}
  />
)}
```

### `IncidentList` Component Update

**Thêm prop `resolutions`:**

```typescript
resolutions: IncidentResolution[]
```

**Status badge cho mỗi incident card:**

```typescript
const resolution = resolutions.find(r => r.incident_id === incident.id)
// Render badge:
// !resolution → <Badge variant='outline'>Pending</Badge>
// resolution.outcome === 'dismissed' → <Badge variant='secondary'>Dismissed</Badge>
// resolution.outcome === 'upheld' → <Badge variant='destructive'>Upheld</Badge>
```

### `IncidentFilters` Component Update

**Thêm props mới:**

```typescript
filterResolutionStatus: string
onFilterResolutionStatusChange: (val: string) => void
```

**Thêm Select dropdown cho resolution filter:**

```typescript
// Options: 'Tất cả' / 'Pending' / 'Dismissed' / 'Upheld'
// Sau filterAppealStatus existing
```

### Permissions — KHÔNG thay đổi

Dùng `canCreateIncident` (đã có) cho Manager-only actions:
- Hiển thị "Resolve Incident" button
- Hiển thị resolution filter

Member tự động thấy resolution của incidents của mình (RLS enforce).

### Timezone Display

Dùng `formatDate(resolution.resolved_at, timezone)` — pattern đã có trong `$incidentId.tsx`.

### RLS Test Bắt Buộc

```sql
-- Test 1: Member thấy resolution của incident của mình
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<member_user_id>", "role": "authenticated", "active_tenant_id": "<tenant_id>"}';
SELECT * FROM incident_resolutions WHERE incident_id = '<incident_for_this_member>';
-- Phải thấy 1 row (hoặc 0 nếu chưa có resolution)
ROLLBACK;

-- Test 2: Member KHÔNG thấy resolution của incident của người khác
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<member_user_id>", "role": "authenticated", "active_tenant_id": "<tenant_id>"}';
SELECT * FROM incident_resolutions WHERE incident_id = '<incident_for_other_member>';
-- Phải EMPTY (0 rows)
ROLLBACK;

-- Test 3: UNIQUE constraint chặn duplicate
INSERT INTO incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
  VALUES ('<tid>', '<iid>', 'dismissed', '<uid>');
INSERT INTO incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
  VALUES ('<tid>', '<iid>', 'upheld', '<uid>');
-- PHẢI fail với unique constraint violation
```

### Files Sẽ Thay Đổi

**Tạo mới:**
- `supabase/migrations/20260326000001_create_incident_resolutions.sql`
- `supabase/functions/notify-resolution/index.ts`
- `src/features/incidents/schemas/resolution.schema.ts`
- `src/features/incidents/hooks/use-resolutions.ts`
- `src/features/incidents/hooks/use-create-resolution.ts`
- `src/features/incidents/components/ResolveIncidentDialog.tsx`

**Chỉnh sửa:**
- `src/features/incidents/services/incident.service.ts` — thêm `IncidentResolution` type + 2 methods
- `src/lib/query-keys.ts` — thêm `incidentResolutions`
- `src/routes/_app/incidents/index.tsx` — resolutions query + filter state + IncidentList props
- `src/routes/_app/incidents/$incidentId.tsx` — resolution section + dialog
- `src/features/incidents/components/IncidentList.tsx` — thêm prop + status badge
- `src/features/incidents/components/IncidentFilters.tsx` — thêm dropdown + prop

**KHÔNG thay đổi:**
- `incidents` table (immutable)
- `incident_appeals` table
- `incident_outcome_notes` table
- `is_incident_victim()` function (tái dụng)
- `is_tenant_manager()` function (tái dụng)
- `current_tenant_id()` function
- Bất kỳ auth flow, route guard nào

### Bẫy Dễ Mắc Phải

1. **RLS recursion:** `is_incident_victim()` đã có SECURITY DEFINER — đừng viết lại inline subquery vào `incidents` trong policy của `incident_resolutions`. Chỉ gọi hàm đã có.

2. **UNIQUE constraint error handling:** Nếu Manager click resolve 2 lần nhanh, INSERT lần 2 sẽ fail với PostgreSQL error code `23505`. Handle ở hook:
   ```typescript
   onError: (error) => {
     if (error.code === '23505') {
       toast.error('Incident này đã được resolve rồi')
     } else {
       toast.error('Không thể resolve incident')
     }
   }
   ```

3. **Query cache sharing:** `useResolutions` dùng cùng `queryKey` ở cả `/incidents` (list) lẫn `/$incidentId` (detail) → cache tự động shared, không cần fetch lại.

4. **Edge Function auth:** Dùng `getUserFromJwt()` từ `../_shared/jwt.ts` — KHÔNG dùng `supabaseAdmin.auth.getUser()` (gây timeout local dev).

5. **Notification type mới:** `'incident_resolved'` — cần check type constraint của `notifications` table. Nếu `type` column là TEXT (không phải ENUM), thêm trực tiếp. Nếu là ENUM, cần migration thêm value.

---

### Project Structure Notes

Tuân thủ đúng cấu trúc feature của `src/features/incidents/`:

```
src/features/incidents/
├── components/
│   ├── AppealDialog.tsx           (existing)
│   ├── CreateIncidentDialog.tsx   (existing)
│   ├── IncidentFilters.tsx        (update)
│   ├── IncidentList.tsx           (update)
│   └── ResolveIncidentDialog.tsx  (NEW)
├── hooks/
│   ├── use-create-incident.ts     (existing)
│   ├── use-create-resolution.ts   (NEW)
│   ├── use-incident-appeals-realtime.ts (existing)
│   ├── use-incidents.ts           (existing)
│   ├── use-infinite-incidents.ts  (existing)
│   └── use-resolutions.ts         (NEW)
├── schemas/
│   ├── appeal.schema.ts           (existing)
│   ├── incident.schema.ts         (existing)
│   ├── outcome-note.schema.ts     (existing)
│   └── resolution.schema.ts       (NEW)
└── services/
    └── incident.service.ts        (update — thêm IncidentResolution type + 2 methods)
```

---

### References

- `sprint-change-proposal-2026-03-26.md#Story-9-3` — yêu cầu gốc + DB migration schema
- `supabase/migrations/20260325000009_create_incident_outcome_notes.sql` — pattern RLS + `is_incident_victim()` function đã tồn tại
- `supabase/migrations/20260323000009_create_incidents.sql` — incidents table schema
- `src/features/incidents/services/incident.service.ts` — service pattern để extend
- `src/features/incidents/hooks/use-create-incident.ts` — mutation hook pattern
- `supabase/functions/notify-incident/index.ts` — Edge Function pattern (auth, verify, insert notification)
- `src/routes/_app/incidents/index.tsx` — filter pattern, resolutions integration point
- `src/routes/_app/incidents/$incidentId.tsx` — detail page để thêm resolution section
- `src/lib/query-keys.ts` — thêm `incidentResolutions`
- Architecture.md: "Audit trail: incidents, appeals là append-only inserts"

---

## Dev Agent Record

### Agent Model Used

_Chưa implement_

### Debug Log References

### Completion Notes List

### File List

_(sẽ điền sau khi implement xong)_
