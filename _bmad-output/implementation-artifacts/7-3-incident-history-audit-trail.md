# Story 7.3: Incident History & Audit Trail

Status: done
Epic: 7 — Incident Management
Story ID: 7.3
Story Key: 7-3-incident-history-audit-trail
Created: 2026-03-25

---

## Story

As a Manager or Owner,
I want to view the complete incident history for the whole team with full audit trail,
So that I have objective data for performance reviews and the system is accountable to everyone.

---

## Acceptance Criteria

**Given** Manager/Owner truy cập `/incidents`
**When** page load
**Then** hiển thị tất cả incidents của cả team theo thứ tự mới nhất trước (đã có từ Story 7-1)
**And** Manager thấy filter bar để lọc theo: member, category, date range, appeal status

**Given** Manager muốn lọc incidents
**When** Manager chọn filter (member / category / date range / appeal status)
**Then** danh sách incidents được cập nhật real-time (client-side filter — không reload)
**And** "Xóa filter" button xuất hiện khi có ít nhất 1 filter active

**Given** Manager muốn xem chi tiết một incident
**When** Manager click "Xem chi tiết →" trên incident card
**Then** navigate đến `/incidents/:incidentId`
**And** trang hiển thị đầy đủ: incident details (category, note, member, manager, timestamp), member appeal (nếu có, với timestamp), danh sách outcome notes (nếu có, với author + timestamp)
**And** Manager thấy form "Thêm ghi chú" để add outcome/response note

**Given** Manager submit outcome note form
**When** submit thành công
**Then** note được INSERT vào `incident_outcome_notes` với: `incident_id`, `manager_id = auth.uid()`, `tenant_id`, `note`, `created_at`
**And** record là immutable — không có UPDATE hay DELETE
**And** member nhận in-app notification type `appeal_reviewed`: "Manager đã thêm ghi chú về incident của bạn." với `link_to: '/incidents/:incidentId'`
**And** form reset, new note xuất hiện ngay trong danh sách (cuối cùng — chronological order)

**Given** bất kỳ action nào (log incident, submit appeal, add outcome note)
**When** action được thực hiện
**Then** action được lưu với actor_id và created_at timestamp
**And** không có record nào bị modify hay xóa — toàn bộ history là immutable append-only

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### DB: 1 migration mới cần tạo

`incident_outcome_notes` table **CHƯA tồn tại** (verified via MCP: chỉ có `incidents` và `incident_appeals`).

**Migration file:** `supabase/migrations/20260325000009_create_incident_outcome_notes.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Helper SECURITY DEFINER: Check caller là victim của incident
-- BẮT BUỘC dùng SECURITY DEFINER vì query vào public.incidents có RLS
-- (tránh lỗi "stack depth limit exceeded" / infinite recursion)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_incident_victim(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.incidents
    WHERE id = p_incident_id
      AND member_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Outcome notes table (append-only, immutable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.incident_outcome_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id)  ON DELETE RESTRICT,
  manager_id  uuid NOT NULL REFERENCES public.users(id),
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — immutable append-only
);

CREATE INDEX idx_incident_outcome_notes_incident_id ON public.incident_outcome_notes(incident_id);
CREATE INDEX idx_incident_outcome_notes_tenant_id   ON public.incident_outcome_notes(tenant_id);

ALTER TABLE public.incident_outcome_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Manager/Owner thấy tất cả trong tenant
--         Member chỉ thấy notes cho incidents bị log đích danh mình
CREATE POLICY incident_outcome_notes_select_policy ON public.incident_outcome_notes
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_manager()
      OR public.is_incident_victim(incident_id)   -- SECURITY DEFINER ⇒ safe
    )
  );

-- INSERT: Chỉ manager/owner được insert, manager_id phải là auth.uid()
CREATE POLICY incident_outcome_notes_insert_policy ON public.incident_outcome_notes
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND manager_id = auth.uid()
    AND public.is_tenant_manager()
  );
```

**Apply migration:**
```bash
npx supabase db push --local
```

**Regenerate types (BẮT BUỘC sau migration có table mới):**
```bash
npx supabase gen types typescript --local > src/lib/supabase-types.ts
```

### DB Schema confirmed (MCP verified 2026-03-25)

```
incidents:              id, tenant_id, member_id, manager_id, category, note, created_at
incident_appeals:       id, tenant_id, incident_id, member_id, response, created_at
incident_outcome_notes: id, tenant_id, incident_id, manager_id, note, created_at  ← MỚI
```

**notification_type enum** đã có `appeal_reviewed` từ migration 20260323000008 — **KHÔNG cần sửa enum**.

### Notification flow — CLIENT-SIDE (không cần Edge Function)

Manager INSERT notification cho member **trực tiếp từ client** (không cần Edge Function):

```typescript
// Trong createOutcomeNote() — service method:
// Manager là caller → notifications_insert_policy chỉ check tenant_id, không restrict user_id
// ⇒ manager có thể INSERT notification cho bất kỳ user nào trong tenant
await supabase.from('notifications').insert({
  tenant_id: params.tenantId,
  user_id:   params.memberId,   // member của incident nhận notification
  type:      'appeal_reviewed' as const,
  message:   'Manager đã thêm ghi chú về incident của bạn.',
  link_to:   `/incidents/${params.incidentId}`,
})
```

**Quy tắc notification:**
- Manager → Member: CLIENT-SIDE INSERT ✅ (pattern này đã dùng trong Story 7-1 `createIncident`)
- Member → Manager: CẦN Edge Function ❌ (đã implement trong Story 7-2 `notify-appeal`)

### Routes hiện tại sau Stories 7-1 và 7-2

```
src/routes/_app/incidents/
└── index.tsx    ← đã có (modified by Story 7-1 + 7-2)
                    KHÔNG có $incidentId.tsx nào — Story 7-3 tạo mới
```

Stories 7-1 và 7-2 đều confirm: "KHÔNG tạo `$incidentId.tsx` — Story 7-3 sẽ handle detail view cho manager."

### Data fetching strategy cho $incidentId.tsx

**Reuse existing cached queries** (không tạo query mới cho incident và appeal):

```typescript
// Trong IncidentDetailPage:
const { data: incidents = [] } = useIncidents(activeTenantId)      // cache hit nếu vừa từ list page
const { data: appeals   = [] } = useAppeals(activeTenantId)        // cache hit nếu vừa từ list page
const { data: members   = [] } = useMembers(activeTenantId)        // cache hit

// Query MỚI chỉ cho outcome notes (chưa có cache):
const { data: outcomeNotes = [] } = useOutcomeNotes(incidentId, activeTenantId)

const incident = incidents.find(i => i.id === incidentId)
const appeal   = appeals.find(a => a.incident_id === incidentId)
```

Nếu user navigate trực tiếp đến URL (không qua list): queries auto-fetch, show loading state.
Nếu incident không tìm thấy (sau load xong) → hiển thị "Incident không tồn tại."

### Filters — Client-side với useMemo

Filter được apply trên `incidents` array đã fetch. Chỉ active cho manager view (`canCreateIncident`):

```typescript
// Trong incidents/index.tsx — các state mới:
const [filterMemberId,     setFilterMemberId]     = useState('')
const [filterCategory,     setFilterCategory]     = useState('')
const [filterDateFrom,     setFilterDateFrom]     = useState('')
const [filterDateTo,       setFilterDateTo]       = useState('')
const [filterAppealStatus, setFilterAppealStatus] = useState('')  // '' | 'appealed' | 'not_appealed'

const filteredIncidents = useMemo(() => {
  if (!canCreateIncident) return incidents  // member — không filter (RLS đã xử lý)

  return incidents.filter(incident => {
    if (filterMemberId && incident.member_id !== filterMemberId) return false
    if (filterCategory && incident.category !== filterCategory) return false
    if (filterDateFrom) {
      const from = new Date(filterDateFrom + 'T00:00:00')
      if (new Date(incident.created_at) < from) return false
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59')
      if (new Date(incident.created_at) > to) return false
    }
    if (filterAppealStatus === 'appealed' && !appeals.some(a => a.incident_id === incident.id)) return false
    if (filterAppealStatus === 'not_appealed' && appeals.some(a => a.incident_id === incident.id)) return false
    return true
  })
}, [incidents, appeals, filterMemberId, filterCategory, filterDateFrom, filterDateTo, filterAppealStatus, canCreateIncident])
```

### Codebase cần tạo mới / sửa

```
src/
├── lib/
│   └── query-keys.ts                              # SỬA: thêm incidentOutcomeNotes
│
├── features/incidents/
│   ├── schemas/
│   │   └── outcome-note.schema.ts                 # MỚI: Zod schema cho outcome note form
│   ├── services/
│   │   └── incident.service.ts                    # SỬA: thêm IncidentOutcomeNote type + 2 methods
│   ├── hooks/
│   │   ├── use-outcome-notes.ts                   # MỚI: useQuery cho outcome notes
│   │   └── use-create-outcome-note.ts             # MỚI: useMutation cho add note
│   └── components/
│       ├── IncidentList.tsx                       # SỬA: thêm prop onViewDetail + button cho manager
│       └── IncidentFilters.tsx                    # MỚI: filter bar cho manager
│
├── routes/_app/incidents/
│   ├── index.tsx                                  # SỬA: filter state + filteredIncidents + navigate
│   └── $incidentId.tsx                            # MỚI: detail page + outcome notes

supabase/migrations/
└── 20260325000009_create_incident_outcome_notes.sql  # MỚI
```

**KHÔNG tạo:**
- Barrel `index.ts` — anti-pattern của project (import trực tiếp từ file)
- Edge Function — notification INSERT trực tiếp từ client (manager context)
- Mới `useMembers` hook — dùng pattern đã có trong `incidents/index.tsx`

---

## Tasks / Subtasks

### Task 1: Migration + Apply + Regenerate Types

**File:** `supabase/migrations/20260325000009_create_incident_outcome_notes.sql`

- [x] Tạo `is_incident_victim(p_incident_id uuid)` SECURITY DEFINER function (xem content đầy đủ ở Critical Context)
- [x] Tạo `incident_outcome_notes` table: `id, tenant_id, incident_id, manager_id, note, created_at` — KHÔNG có `updated_at`
- [x] Tạo 2 indexes: `incident_id`, `tenant_id`
- [x] `ALTER TABLE public.incident_outcome_notes ENABLE ROW LEVEL SECURITY`
- [x] SELECT policy: `current_tenant_id()` AND `(is_tenant_manager() OR is_incident_victim(incident_id))`
- [x] INSERT policy: `current_tenant_id()` AND `manager_id = auth.uid()` AND `is_tenant_manager()`
- [x] `npx supabase db push --local`
- [x] `npx supabase gen types typescript --local > src/lib/supabase-types.ts`

### Task 2: Update QUERY_KEYS

**File:** `src/lib/query-keys.ts`

Thêm dòng mới vào cuối object (trước `} as const`):

```typescript
incidentOutcomeNotes: 'incident-outcome-notes',
```

- [x] Sửa `src/lib/query-keys.ts`

### Task 3: Schema — `outcome-note.schema.ts`

**File:** `src/features/incidents/schemas/outcome-note.schema.ts`

```typescript
import { z } from 'zod'

export const createOutcomeNoteSchema = z.object({
  note: z
    .string()
    .min(1, 'Ghi chú là bắt buộc')
    .max(2000, 'Ghi chú tối đa 2000 ký tự'),
})

export type CreateOutcomeNoteInput = z.infer<typeof createOutcomeNoteSchema>
```

- [x] Tạo `src/features/incidents/schemas/outcome-note.schema.ts`

### Task 4: Extend Service — `incident.service.ts`

**File:** `src/features/incidents/services/incident.service.ts`

Thêm vào cuối file hiện tại — KHÔNG xóa gì:

```typescript
// ─── Thêm type export mới (sau IncidentAppeal) ───────────────────────────────
export type IncidentOutcomeNote = Tables<'incident_outcome_notes'>

// ─── Thêm 2 methods vào IncidentService object hiện tại ──────────────────────

  getIncidentOutcomeNotes: async (
    incidentId: string,
    tenantId: string
  ): Promise<IncidentOutcomeNote[]> => {
    const { data, error } = await supabase
      .from('incident_outcome_notes')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })  // chronological — cũ nhất trước
    if (error) throw error
    return data ?? []
  },

  createOutcomeNote: async (params: {
    tenantId:   string
    incidentId: string
    managerId:  string
    memberId:   string   // member của incident — để INSERT notification
    note:       string
  }): Promise<IncidentOutcomeNote> => {
    // INSERT outcome note (manager_id = auth.uid(), RLS enforce is_tenant_manager())
    const { data: outcomeNote, error: noteError } = await supabase
      .from('incident_outcome_notes')
      .insert({
        tenant_id:   params.tenantId,
        incident_id: params.incidentId,
        manager_id:  params.managerId,
        note:        params.note,
      })
      .select()
      .single()
    if (noteError) throw noteError

    // Notify member — manager INSERT trực tiếp (không cần Edge Function)
    // Best-effort: outcome note đã tạo thành công dù notification fail
    try {
      await supabase.from('notifications').insert({
        tenant_id: params.tenantId,
        user_id:   params.memberId,
        type:      'appeal_reviewed' as const,
        message:   'Manager đã thêm ghi chú về incident của bạn.',
        link_to:   `/incidents/${params.incidentId}`,
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createOutcomeNote] notification failed (best-effort):', err)
    }

    return outcomeNote
  },
```

- [x] Extend `src/features/incidents/services/incident.service.ts`

### Task 5: Hook — `use-outcome-notes.ts`

**File:** `src/features/incidents/hooks/use-outcome-notes.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useOutcomeNotes(incidentId: string | null, tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentOutcomeNotes, incidentId, tenantId],
    queryFn:  () => IncidentService.getIncidentOutcomeNotes(incidentId!, tenantId!),
    staleTime: 30 * 1000,
    enabled:   !!incidentId && !!tenantId,
  })
}
```

- [x] Tạo `src/features/incidents/hooks/use-outcome-notes.ts`

### Task 6: Hook — `use-create-outcome-note.ts`

**File:** `src/features/incidents/hooks/use-create-outcome-note.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateOutcomeNoteParams {
  tenantId:   string
  incidentId: string
  managerId:  string
  memberId:   string
  note:       string
}

export function useCreateOutcomeNote(tenantId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateOutcomeNoteParams) =>
      IncidentService.createOutcomeNote(params),

    onSuccess: () => {
      toast.success('Ghi chú đã được thêm')
    },

    onError: () => {
      toast.error('Không thể thêm ghi chú')
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.incidentOutcomeNotes, variables.incidentId, tenantId],
      })
    },
  })
}
```

- [x] Tạo `src/features/incidents/hooks/use-create-outcome-note.ts`

### Task 7: Component — `IncidentFilters.tsx`

**File:** `src/features/incidents/components/IncidentFilters.tsx`

Component manager-only filter bar. Dùng shadcn `Select` cho dropdowns + `Input type="date"` cho dates.

```typescript
interface IncidentFiltersProps {
  members:                  TenantMemberWithUser[]
  filterMemberId:           string
  filterCategory:           string
  filterDateFrom:           string
  filterDateTo:             string
  filterAppealStatus:       string
  onFilterMemberChange:     (value: string) => void
  onFilterCategoryChange:   (value: string) => void
  onFilterDateFromChange:   (value: string) => void
  onFilterDateToChange:     (value: string) => void
  onFilterAppealStatusChange: (value: string) => void
  onReset:                  () => void
}
```

**Layout:** `<div className="flex flex-wrap gap-2 items-center">` — horizontal flex, responsive wrap.

**Controls:**
```
[Select: Thành viên] [Select: Loại incident] [Input: Từ ngày] [Input: Đến ngày] [Select: Appeal] [Button: Xóa filter]
```

**Dropdown values:**
- Member Select: value="" → "Tất cả thành viên" | members.map → value=m.user_id, label=m.users.full_name
- Category Select: value="" → "Tất cả loại" | Object.entries(INCIDENT_CATEGORY_LABELS) → value=key, label=label
- Date Inputs: `<Input type="date" className="h-8 w-36 text-sm" />`
- Appeal Select: value="" → "Tất cả" | value="appealed" → "Đã appeal" | value="not_appealed" → "Chưa appeal"
- Xóa filter Button: `variant="ghost" size="sm"` — chỉ hiển thị khi `filterMemberId || filterCategory || filterDateFrom || filterDateTo || filterAppealStatus`

**Imports:**
```typescript
import { INCIDENT_CATEGORY_LABELS } from '@/features/incidents/schemas/incident.schema'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
```

- [x] Tạo `src/features/incidents/components/IncidentFilters.tsx`

### Task 8: Modify IncidentList — Thêm "Xem chi tiết" button

**File:** `src/features/incidents/components/IncidentList.tsx`

**Thêm prop mới vào interface:**
```typescript
onViewDetail?: (incidentId: string) => void  // undefined = member view (không có navigation)
```

**Trong render mỗi incident card**, thêm "Xem chi tiết →" button (chỉ khi `onViewDetail` được provide):
```typescript
{onViewDetail && (
  <Button
    size='sm'
    variant='ghost'
    className='h-7 text-xs'
    onClick={() => onViewDetail(incident.id)}
  >
    Xem chi tiết →
  </Button>
)}
```

Đặt button ở khu vực phù hợp trong card header (bên cạnh appeal badge hoặc cuối phần action).

- [x] Modify `src/features/incidents/components/IncidentList.tsx`

### Task 9: Modify Route — `incidents/index.tsx`

**File:** `src/routes/_app/incidents/index.tsx`

**Imports mới cần thêm:**
```typescript
import { useMemo, useState } from 'react'
import { useNavigate }        from '@tanstack/react-router'
import { IncidentFilters }    from '@/features/incidents/components/IncidentFilters'
```

**Thêm sau `const { canCreateIncident } = usePermissions()`:**
```typescript
const navigate = useNavigate()

// Filter state (manager view only)
const [filterMemberId,     setFilterMemberId]     = useState('')
const [filterCategory,     setFilterCategory]     = useState('')
const [filterDateFrom,     setFilterDateFrom]     = useState('')
const [filterDateTo,       setFilterDateTo]       = useState('')
const [filterAppealStatus, setFilterAppealStatus] = useState('')

const filteredIncidents = useMemo(() => {
  if (!canCreateIncident) return incidents
  return incidents.filter(incident => {
    if (filterMemberId && incident.member_id !== filterMemberId) return false
    if (filterCategory && incident.category !== filterCategory) return false
    if (filterDateFrom && new Date(incident.created_at) < new Date(filterDateFrom + 'T00:00:00')) return false
    if (filterDateTo   && new Date(incident.created_at) > new Date(filterDateTo   + 'T23:59:59')) return false
    if (filterAppealStatus === 'appealed'     && !appeals.some(a => a.incident_id === incident.id)) return false
    if (filterAppealStatus === 'not_appealed' &&  appeals.some(a => a.incident_id === incident.id)) return false
    return true
  })
}, [incidents, appeals, filterMemberId, filterCategory, filterDateFrom, filterDateTo, filterAppealStatus, canCreateIncident])

const handleResetFilters = () => {
  setFilterMemberId('')
  setFilterCategory('')
  setFilterDateFrom('')
  setFilterDateTo('')
  setFilterAppealStatus('')
}
```

**Thêm IncidentFilters (manager only), đặt ngay trước IncidentList:**
```typescript
{canCreateIncident && (
  <IncidentFilters
    members={members}
    filterMemberId={filterMemberId}
    filterCategory={filterCategory}
    filterDateFrom={filterDateFrom}
    filterDateTo={filterDateTo}
    filterAppealStatus={filterAppealStatus}
    onFilterMemberChange={setFilterMemberId}
    onFilterCategoryChange={setFilterCategory}
    onFilterDateFromChange={setFilterDateFrom}
    onFilterDateToChange={setFilterDateTo}
    onFilterAppealStatusChange={setFilterAppealStatus}
    onReset={handleResetFilters}
  />
)}
```

**Update IncidentList call** — truyền `filteredIncidents` thay `incidents` và thêm `onViewDetail`:
```typescript
<IncidentList
  incidents={filteredIncidents}   // ← thay thế incidents
  isLoading={isIncidentsLoading}
  members={members}
  userTimezone={timezone}
  appeals={appeals}
  currentUserId={user?.id}
  canAppeal={!canCreateIncident}
  onAppeal={(incidentId) => setAppealIncidentId(incidentId)}
  onViewDetail={
    canCreateIncident
      ? (incidentId) => navigate({ to: '/incidents/$incidentId', params: { incidentId } })
      : undefined
  }
/>
```

- [x] Modify `src/routes/_app/incidents/index.tsx`

### Task 10: New Route — `$incidentId.tsx`

**File:** `src/routes/_app/incidents/$incidentId.tsx`

**Route setup:**
```typescript
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/incidents/$incidentId')({
  component: IncidentDetailPage,
})
```

**Component:**
```typescript
function IncidentDetailPage() {
  const { incidentId } = Route.useParams()
  const { activeTenantId, user } = useAuthStore()
  const { canCreateIncident } = usePermissions()

  // Reuse existing cached queries
  const { data: incidents = [], isLoading: isIncidentsLoading } = useIncidents(activeTenantId)
  const { data: appeals   = [] }                                 = useAppeals(activeTenantId)
  const { data: members   = [] }                                 = useMembers(activeTenantId)
  const { data: profile }                                        = useUserProfile(user?.id ?? null)

  // Outcome notes — new query
  const { data: outcomeNotes = [], isLoading: isNotesLoading } = useOutcomeNotes(incidentId, activeTenantId)
  const createOutcomeNote = useCreateOutcomeNote(activeTenantId)

  const incident    = incidents.find(i => i.id === incidentId)
  const appeal      = appeals.find(a => a.incident_id === incidentId)
  const userTimezone = profile?.timezone ?? null

  // Outcome note form
  const form = useForm<CreateOutcomeNoteInput>({
    resolver: zodResolver(createOutcomeNoteSchema),
    defaultValues: { note: '' },
  })

  const handleSubmitNote = form.handleSubmit((data) => {
    if (!activeTenantId || !user || !incident) return
    createOutcomeNote.mutate({
      tenantId:   activeTenantId,
      incidentId,
      managerId:  user.id,
      memberId:   incident.member_id,
      note:       data.note,
    }, {
      onSuccess: () => form.reset(),
    })
  })

  // Loading state
  if (isIncidentsLoading) {
    return <div>Đang tải...</div>   // hoặc skeleton
  }

  // Not found (sau khi load xong)
  if (!incident) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Incident không tồn tại hoặc bạn không có quyền xem.</p>
        <Link to="/incidents" className="text-sm underline mt-2 inline-block">← Quay lại</Link>
      </div>
    )
  }

  const memberName  = getMemberName(members, incident.member_id)
  const managerName = getMemberName(members, incident.manager_id)

  return (
    <>
      <title>Chi tiết Incident — TekSpace</title>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Back button + Header */}
        <div className="space-y-1">
          <Link to="/incidents" className="text-sm text-muted-foreground hover:text-foreground">
            ← Quay lại Incidents
          </Link>
          <h1 className="text-xl font-semibold">Chi tiết Incident</h1>
        </div>

        {/* Section 1: Incident Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Thông tin Incident</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CategoryBadge category={incident.category} />  {/* dùng Badge + INCIDENT_CATEGORY_LABELS */}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Thành viên</p>
                <p className="font-medium">{memberName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ghi nhận bởi</p>
                <p className="font-medium">{managerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Thời gian</p>
                <p className="font-medium">{formatDate(incident.created_at, userTimezone)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ghi chú</p>
              <p className="text-sm whitespace-pre-wrap">{incident.note}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Appeal (chỉ hiển thị khi có appeal) */}
        {appeal && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Appeal của thành viên</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Gửi lúc: {formatDate(appeal.created_at, userTimezone)}
              </p>
              <p className="text-sm whitespace-pre-wrap">{appeal.response}</p>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Outcome Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ghi chú Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing notes list (chronological) */}
            {isNotesLoading ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : outcomeNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có ghi chú nào.</p>
            ) : (
              <div className="space-y-3">
                {outcomeNotes.map(n => (
                  <div key={n.id} className="rounded-md bg-muted/50 border px-3 py-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {getMemberName(members, n.manager_id)} • {formatDate(n.created_at, userTimezone)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add note form (manager only) */}
            {canCreateIncident && (
              <form onSubmit={handleSubmitNote} className="space-y-2 pt-2 border-t">
                <Textarea
                  {...form.register('note')}
                  placeholder="Thêm ghi chú về incident này..."
                  rows={3}
                  className="resize-none"
                />
                {form.formState.errors.note && (
                  <p className="text-xs text-destructive">{form.formState.errors.note.message}</p>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={createOutcomeNote.isPending}
                >
                  {createOutcomeNote.isPending ? 'Đang lưu...' : 'Thêm ghi chú'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
```

**Imports cần có trong `$incidentId.tsx`:**
```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '@/store/auth.store'          // hoặc pattern đang dùng trong incidents/index.tsx
import { usePermissions } from '@/hooks/use-permissions'
import { useIncidents } from '@/features/incidents/hooks/use-incidents'
import { useAppeals } from '@/features/incidents/hooks/use-appeals'
import { useOutcomeNotes } from '@/features/incidents/hooks/use-outcome-notes'
import { useCreateOutcomeNote } from '@/features/incidents/hooks/use-create-outcome-note'
import { createOutcomeNoteSchema, type CreateOutcomeNoteInput } from '@/features/incidents/schemas/outcome-note.schema'
import { INCIDENT_CATEGORY_LABELS } from '@/features/incidents/schemas/incident.schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// useUserProfile, useMembers — xem pattern import trong incidents/index.tsx hiện tại
// getMemberName helper — xem bên dưới
// formatDate helper — xem bên dưới
```

**`getMemberName` helper:** Xem trong `IncidentList.tsx` — nếu function này KHÔNG export → inline duplicate trong `$incidentId.tsx`. KHÔNG refactor để export nếu chưa cần thiết (tránh regression).

**`formatDate` helper:** Xem trong `IncidentList.tsx` — cùng pattern, dùng userTimezone, fallback UTC.

**`useMembers` / `useUserProfile`:** Xem chính xác tên hook trong `src/routes/_app/incidents/index.tsx` hiện tại — có thể là `useProfile`, `useUserProfile`, `useTenantMembers`, v.v.

- [x] Tạo `src/routes/_app/incidents/$incidentId.tsx`

### Task 11: DB Tests

```bash
npx supabase test db
```

Tất cả tests phải PASS. Nếu có `not ok` → fix migration → chạy lại.

---

## Dev Notes

### Patterns tham khảo

| Pattern | File tham khảo |
|---------|---------------|
| SECURITY DEFINER function | `is_tenant_manager()` trong DB — xem `supabase/migrations/202603230000xx_rls_policies.sql` |
| Append-only INSERT + immutable | `incidents`, `incident_appeals` tables |
| Manager→Member notification client-side | `incident.service.ts` `createIncident()` |
| useQuery hook | `src/features/incidents/hooks/use-incidents.ts` |
| useMutation + invalidate | `src/features/incidents/hooks/use-create-incident.ts` |
| Dynamic route params | Pattern TanStack Router — `Route.useParams()` → `{ incidentId }` |
| useNavigate | `import { useNavigate } from '@tanstack/react-router'` |
| Link component | `import { Link } from '@tanstack/react-router'` |
| Form với react-hook-form + zodResolver | `src/features/incidents/components/CreateIncidentDialog.tsx` |
| Card layout | Xem các story trước về Daily Report, Analytics |

### RLS behavior tóm tắt

| Role | `incident_outcome_notes` SELECT | `incident_outcome_notes` INSERT |
|------|--------------------------------|----------------------------------|
| Manager/Owner | ✅ Tất cả trong tenant | ✅ Được (manager_id = auth.uid()) |
| Member | ✅ Chỉ notes cho incidents của mình | ❌ Không được |

### Outcome notes — ascending order (cũ nhất trước)

`order('created_at', { ascending: true })` — khác với incidents/appeals (descending). Lý do: audit trail nên đọc theo timeline từ đầu đến cuối, cùng như đọc lịch sử.

### Filters — Không cần URL search params

Client-side `useState` là đủ cho MVP. Không cần TanStack Router search params (overkill).

### Không cần Realtime cho outcome notes

Appeal cần Realtime vì manager cần thấy ngay khi member submit. Outcome notes: chỉ manager (người đang xem page) thêm vào → local `invalidateQueries` là đủ. Không subscribe Realtime.

### Head title pattern

Xem chính xác pattern trong `src/routes/_app/incidents/index.tsx` — có thể là:
- Inline `<title>` tag trong JSX
- Hoặc `head()` function trong `createFileRoute` options

Dùng cùng pattern để nhất quán.

### getMemberName và formatDate helpers

Nếu cả hai helpers này KHÔNG được export từ `IncidentList.tsx`:
- **Option A (preferred):** Inline trong `$incidentId.tsx` — tránh regression
- **Option B:** Extract sang `src/features/incidents/utils/incident-helpers.ts` và import từ cả 2 file — chỉ làm nếu cảm thấy cần

Quyết định sau khi đọc `IncidentList.tsx` thực tế.

### `useMembers` hook pattern

Trong `incidents/index.tsx`, `members` data được fetch bằng cách nào? Check để dùng cùng pattern trong `$incidentId.tsx`. Có thể là:
- `useMembers(tenantId)` hook riêng
- Hoặc `useTenantMembers(tenantId)`
- Hoặc `useQuery` inline với `getMembers` từ tenant service

### Project Structure Notes

- Feature folder: `src/features/incidents/` — đã tồn tại
- Route: `src/routes/_app/incidents/$incidentId.tsx` — TanStack Router dynamic segment
- Không tạo barrel `index.ts` — import trực tiếp từ file (anti-pattern of project)
- `supabase-types.ts` phải regenerate sau migration (Task 1 — không skip)

### References

- [Source: _bmad-output/implementation-artifacts/7-1-log-incident.md] — notification pattern, DB schema
- [Source: _bmad-output/implementation-artifacts/7-2-member-incident-view-appeal.md] — existing codebase structure, hook patterns, bug fixes (getUserFromJwt pattern)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] — acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Incident Management] — audit trail principle, append-only
- [Source: src/features/incidents/services/incident.service.ts] — service pattern to extend
- [Source: src/lib/query-keys.ts] — QUERY_KEYS constants (incidentOutcomeNotes cần thêm)
- [Source: supabase/migrations/20260323000009_create_incidents.sql] — migration structure pattern
- [Source: CLAUDE.md#Database & RLS] — RLS checklist, SECURITY DEFINER requirement

---

## Anti-patterns cần tránh

- ❌ KHÔNG tạo `UPDATE` hay `DELETE` trên `incident_outcome_notes` — immutable append-only
- ❌ KHÔNG dùng inline subquery vào bảng có RLS trong SELECT policy — dùng `SECURITY DEFINER` function (`is_incident_victim`)
- ❌ KHÔNG tạo Edge Function cho manager→member notification — INSERT trực tiếp từ client
- ❌ KHÔNG tạo barrel `index.ts` — import trực tiếp từ file
- ❌ KHÔNG hardcode query key strings — dùng `QUERY_KEYS.incidentOutcomeNotes`
- ❌ KHÔNG chạy `supabase gen types` TRƯỚC khi apply migration
- ❌ KHÔNG dùng `filter()` cho member view incidents — RLS đã lọc sẵn
- ❌ KHÔNG hardcode category strings trong IncidentFilters — import `INCIDENT_CATEGORY_LABELS` từ `incident.schema.ts`
- ❌ KHÔNG tạo new members query trong `$incidentId.tsx` nếu đã có pattern trong `incidents/index.tsx`
- ❌ KHÔNG sort outcome notes `descending` — phải `ascending` (chronological audit trail)
- ❌ KHÔNG import từ `react-router-dom` — dùng `@tanstack/react-router`

---

## Kiểm tra sau khi implement

- [x] Migration 20260325000009 apply thành công (`npx supabase db push --local`)
- [x] `supabase-types.ts` đã regenerate — `incident_outcome_notes` có trong types
- [ ] Manager thấy filter bar ở đầu incidents list
- [ ] Filter theo member hoạt động đúng (match member_id)
- [ ] Filter theo category hoạt động đúng
- [ ] Filter date range hoạt động (inclusive from/to)
- [ ] Filter appeal status "Đã appeal" / "Chưa appeal" đúng
- [ ] "Xóa filter" button chỉ hiển thị khi có filter active
- [ ] "Xem chi tiết →" button xuất hiện trong incident card (manager only)
- [ ] Navigate đến `/incidents/:id` thành công
- [ ] Detail page hiển thị: incident info đầy đủ (không truncate note)
- [ ] Appeal section hiển thị khi có appeal, ẩn khi không có
- [ ] Outcome notes hiển thị theo thứ tự chronological (cũ nhất trước)
- [ ] Manager có thể thêm outcome note → note xuất hiện ngay sau submit
- [ ] Form reset sau submit thành công
- [ ] Member nhận notification type `appeal_reviewed` khi manager add note
- [ ] Member NOT thấy form "Thêm ghi chú" (canCreateIncident = false)
- [ ] Navigate trực tiếp đến URL `/incidents/:id` (cold cache) vẫn load đúng
- [x] `npx supabase test db` PASS toàn bộ

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- **Story spec sai về notification pattern:** Story notes nói "Manager → Member notification là CLIENT-SIDE INSERT". Thực tế `notifications_insert_policy` (migration 20260324000004) enforce `user_id = auth.uid()` → client không thể INSERT cho người khác. Phải dùng Edge Function `notify-outcome-note`. Pattern này giống hệt Story 7-1 (`notify-incident`) và Story 7-2 (`notify-appeal`).

- **ESLint no-duplicate-imports:** `$incidentId.tsx` import `@/features/tenant/services/tenant.service` hai lần (`getMembers` + `TenantMemberWithUser`). Fix: gộp thành `import { getMembers, type TenantMemberWithUser } from ...`

### Completion Notes List

- ✅ Task 1: Migration `20260325000009_create_incident_outcome_notes.sql` — `is_incident_victim` SECURITY DEFINER, bảng `incident_outcome_notes`, 2 indexes, RLS enabled, SELECT/INSERT policies → applied, types regenerated
- ✅ Task 2: Sửa `query-keys.ts` — thêm `incidentOutcomeNotes: 'incident-outcome-notes'`
- ✅ Task 3: Tạo `outcome-note.schema.ts` — Zod schema min/max với messages tiếng Việt
- ✅ Task 4: Extended `incident.service.ts` — thêm `IncidentOutcomeNote` type, `getIncidentOutcomeNotes` (ascending order), `createOutcomeNote` (best-effort Edge Function notification), Edge Function `notify-outcome-note` (verify caller manager, verify incident member, INSERT notification cho member)
- ✅ Task 5: Tạo `use-outcome-notes.ts` — useQuery với `[QUERY_KEYS.incidentOutcomeNotes, incidentId, tenantId]`
- ✅ Task 6: Tạo `use-create-outcome-note.ts` — useMutation, onSettled invalidates bằng `variables.incidentId`
- ✅ Task 7: Tạo `IncidentFilters.tsx` — 5 controls (member, category, date from/to, appeal status), "Xóa filter" ghost button chỉ hiện khi active, dùng `INCIDENT_CATEGORY_LABELS` từ schema
- ✅ Task 8: Modified `IncidentList.tsx` — thêm `onViewDetail?` prop, "Xem chi tiết →" ghost button trong header row khi prop defined, appeal status badge hiển thị cho cả member và manager
- ✅ Task 9: Modified `incidents/index.tsx` — filter state + `filteredIncidents` useMemo, `IncidentFilters` render chỉ cho manager, `onViewDetail` navigate đến `$incidentId`, `useNavigate` từ TanStack Router
- ✅ Task 10: Tạo `$incidentId.tsx` — reuse cached queries (incidents/appeals/members), `useOutcomeNotes` cho notes, `useCreateOutcomeNote` mutation, form reset onSuccess, skeleton loading state, "not found" state, 3 sections: incident info / appeal / outcome notes
- ✅ Task 11: `npx supabase test db` → 68/68 PASS
- ✅ TypeScript check: 0 errors
- ✅ ESLint: 0 errors, 0 warnings (sau fix duplicate import)

### File List

- `supabase/migrations/20260325000009_create_incident_outcome_notes.sql` (mới)
- `supabase/functions/notify-outcome-note/index.ts` (mới)
- `src/lib/query-keys.ts` (sửa — thêm incidentOutcomeNotes)
- `src/lib/supabase-types.ts` (regenerated — thêm incident_outcome_notes)
- `src/features/incidents/schemas/outcome-note.schema.ts` (mới)
- `src/features/incidents/services/incident.service.ts` (sửa — thêm IncidentOutcomeNote type + 2 methods)
- `src/features/incidents/hooks/use-outcome-notes.ts` (mới)
- `src/features/incidents/hooks/use-create-outcome-note.ts` (mới)
- `src/features/incidents/components/IncidentFilters.tsx` (mới)
- `src/features/incidents/components/IncidentList.tsx` (sửa — onViewDetail prop + button)
- `src/routes/_app/incidents/index.tsx` (sửa — filter state, IncidentFilters, filteredIncidents, onViewDetail navigate)
- `src/routes/_app/incidents/$incidentId.tsx` (mới — detail page + outcome notes form)
