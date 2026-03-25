# Story 7.2: Member Incident View & Appeal

Status: review
Epic: 7 — Incident Management
Story ID: 7.2
Story Key: 7-2-member-incident-view-appeal
Created: 2026-03-25

---

## Story

As a member,
I want to view incidents logged against me and submit an appeal if I disagree,
So that I have a fair chance to provide my side of the story and the process is transparent.

---

## Acceptance Criteria

**Given** member truy cập trang `/incidents`
**When** page load
**Then** hiển thị danh sách tất cả incidents được log cho member theo thứ tự mới nhất trước
**And** mỗi incident hiển thị: category, manager note, date, appeal status ("Chưa appeal" / "Đã gửi appeal")

**Given** member muốn submit appeal cho một incident chưa có appeal
**When** member click "Gửi Appeal" và nhập nội dung response (bắt buộc)
**Then** appeal được INSERT vào DB với: `incident_id`, `member_id = auth.uid()`, `tenant_id`, `response`, `created_at`
**And** appeal là append-only — không có edit/delete operation nào
**And** Manager nhận in-app notification: "[Member name] đã gửi appeal cho incident ngày [dd/MM/yyyy]."
**And** dialog đóng, incident card cập nhật hiển thị appeal response

**Given** member đã submit appeal cho một incident
**When** member xem incident đó
**Then** appeal response được hiển thị kèm trong incident card (không thể submit thêm)
**And** "Gửi Appeal" button không còn xuất hiện cho incident đó

**Given** Manager/Owner truy cập `/incidents` (team view — đã có từ Story 7-1)
**When** Manager xem incident có appeal
**Then** Manager thấy appeal response của member kèm theo incident card
**And** Manager KHÔNG thấy "Gửi Appeal" button (permission guard — `canCreateIncident` = false)

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Không cần migration

Tất cả DB schema đã tồn tại từ Story 7-1:

| Thành phần | Migration | Trạng thái |
|-----------|-----------|-----------|
| `incident_appeals` table + indexes | 20260323000010 | ✅ Đã có |
| `incident_appeals` RLS policies | 20260323000011 | ✅ Đã có |
| `notification_type` enum (`appeal_submitted`) | 20260323000008 | ✅ Đã có |
| `QUERY_KEYS.incidentAppeals = 'incident-appeals'` | `src/lib/query-keys.ts` | ✅ Đã có |

### DB Schema: incident_appeals

```sql
CREATE TABLE public.incident_appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE RESTRICT,
  member_id   uuid NOT NULL REFERENCES public.users(id),
  response    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- KHÔNG có updated_at — immutable
  UNIQUE (incident_id, member_id)  -- 1 appeal per incident per member
);

CREATE INDEX idx_incident_appeals_incident_id ON public.incident_appeals(incident_id);
-- RLS đã ENABLE
```

### RLS incident_appeals đã active

```sql
-- SELECT: member chỉ thấy appeal của mình; manager thấy tất cả
CREATE POLICY incident_appeals_select_policy ON public.incident_appeals
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (member_id = auth.uid() OR public.is_tenant_manager())
  );

-- INSERT: member_id phải là auth.uid() VÀ phải là victim của incident
CREATE POLICY incident_appeals_insert_policy ON public.incident_appeals
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND member_id  = auth.uid()
    AND member_id = (
      SELECT i.member_id FROM public.incidents i WHERE i.id = incident_id
    )
  );
```

**Kết luận RLS:**
- Member có thể INSERT appeal trực tiếp từ client (khác với notification INSERT)
- `UNIQUE (incident_id, member_id)` → DB tự block insert appeal lần 2 cho cùng incident
- **Chỉ notification** cần Edge Function (member không thể INSERT notification cho manager)

### Notification via Edge Function — BẮBT BUỘC

**Vấn đề (giống Story 7-1):** `notifications_insert_policy` có `tenant_id = current_tenant_id()` nhưng không restrict `user_id`. Tuy nhiên, GoTrue enforce user context khi client call — member chỉ có thể INSERT notification cho chính mình.

**Fix:** Tạo Edge Function `supabase/functions/notify-appeal/index.ts` với service role key.

Pattern giống hệt `notify-incident/index.ts`:
- Nhận `{ incidentId, tenantId }` từ member (memberId = auth.uid() lấy từ JWT)
- Verify caller là active member trong tenant
- Verify `incident.member_id = caller.id` (chỉ victim mới được appeal)
- Query `users` để lấy `full_name` cho notification message
- Query `incidents.created_at` để format ngày trong message
- INSERT notification vào tất cả owner/manager trong tenant với service role

### Codebase hiện tại cần extend (không tạo lại)

```
src/features/incidents/           ← đã có từ Story 7-1
├── schemas/incident.schema.ts    ← GIỮ NGUYÊN, không sửa
├── services/incident.service.ts  ← EXTEND: thêm IncidentAppeal type + 2 methods
├── hooks/use-incidents.ts        ← GIỮ NGUYÊN
├── hooks/use-create-incident.ts  ← GIỮ NGUYÊN
└── components/
    ├── CreateIncidentDialog.tsx  ← GIỮ NGUYÊN
    └── IncidentList.tsx          ← MODIFY: thêm appeal UI
```

### ROUTES và state hiện tại

- Route `/incidents` đã có tại `src/routes/_app/incidents/index.tsx`
- `incidents/index.tsx` đã fetch `incidents` + `members` + `userTimezone`
- Story 7-2 cần MODIFY `index.tsx` để fetch thêm `appeals`
- **KHÔNG tạo route mới** — appeal UI là inline trong `/incidents` page

---

## Cấu trúc file cần tạo / sửa

```
src/
├── features/incidents/
│   ├── schemas/
│   │   └── appeal.schema.ts            # MỚI: Zod schema cho appeal form
│   ├── services/
│   │   └── incident.service.ts         # SỬA: thêm IncidentAppeal type + getIncidentAppeals, createAppeal
│   ├── hooks/
│   │   ├── use-appeals.ts              # MỚI: useQuery cho incident_appeals
│   │   └── use-create-appeal.ts        # MỚI: useMutation cho submit appeal
│   └── components/
│       ├── AppealDialog.tsx            # MỚI: Dialog submit appeal
│       └── IncidentList.tsx            # SỬA: thêm appeal status + Appeal button
│
├── routes/_app/incidents/
│   └── index.tsx                       # SỬA: thêm appeals query + props
│
supabase/functions/
└── notify-appeal/
    └── index.ts                        # MỚI: Edge Function notify managers
```

**KHÔNG tạo:**
- `$incidentId.tsx` — Story 7-3 sẽ handle detail view cho manager
- Barrel `index.ts` — anti-pattern của project
- Migration mới — schema đã đủ

---

## Tasks / Subtasks

### Task 1: Schema — `src/features/incidents/schemas/appeal.schema.ts`

```typescript
import { z } from 'zod'

export const createAppealSchema = z.object({
  response: z
    .string()
    .min(1, 'Nội dung phản hồi là bắt buộc')
    .max(2000, 'Phản hồi tối đa 2000 ký tự'),
})

export type CreateAppealInput = z.infer<typeof createAppealSchema>
```

- [x] Tạo `src/features/incidents/schemas/appeal.schema.ts`

### Task 2: Extend Service — `src/features/incidents/services/incident.service.ts`

Thêm vào cuối file hiện tại (KHÔNG xóa gì):

```typescript
import type { Tables } from '@/lib/supabase-types'

// Thêm type export mới
export type IncidentAppeal = Tables<'incident_appeals'>

// Thêm 2 methods vào IncidentService object hiện tại:

  getIncidentAppeals: async (tenantId: string): Promise<IncidentAppeal[]> => {
    const { data, error } = await supabase
      .from('incident_appeals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  createAppeal: async (params: {
    tenantId: string
    incidentId: string
    memberId: string
    response: string
  }): Promise<IncidentAppeal> => {
    // INSERT appeal — member_id = auth.uid(), RLS enforce victim check tự động
    const { data: appeal, error: appealError } = await supabase
      .from('incident_appeals')
      .insert({
        tenant_id:   params.tenantId,
        incident_id: params.incidentId,
        member_id:   params.memberId,
        response:    params.response,
      })
      .select()
      .single()
    if (appealError) throw appealError

    // Notify managers qua Edge Function (service role bypass RLS)
    // Best-effort: appeal đã tạo thành công dù notification fail
    try {
      await supabase.functions.invoke('notify-appeal', {
        body: {
          incidentId: params.incidentId,
          tenantId:   params.tenantId,
        },
      })
    } catch (err) {
      console.warn('[createAppeal] notification failed (best-effort):', err)
    }

    return appeal
  },
```

**Lưu ý:**
- `memberId` truyền từ `user.id` (auth store) — không query lại
- `UNIQUE (incident_id, member_id)` DB constraint → nếu submit lần 2 sẽ throw error (xử lý qua `onError` toast)

- [x] Extend `src/features/incidents/services/incident.service.ts`

### Task 3: Hook — `src/features/incidents/hooks/use-appeals.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useAppeals(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
    queryFn: () => IncidentService.getIncidentAppeals(tenantId!),
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  })
}
```

- [x] Tạo `src/features/incidents/hooks/use-appeals.ts`

### Task 4: Hook — `src/features/incidents/hooks/use-create-appeal.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateAppealParams {
  tenantId: string
  incidentId: string
  memberId: string
  response: string
}

export function useCreateAppeal(tenantId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateAppealParams) =>
      IncidentService.createAppeal(params),

    onSuccess: () => {
      toast.success('Appeal đã được gửi thành công')
    },

    onError: (error: Error) => {
      // Kiểm tra lỗi duplicate (đã appeal rồi)
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('Bạn đã gửi appeal cho incident này rồi')
      } else {
        toast.error('Không thể gửi appeal')
      }
    },

    onSettled: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
        })
      }
    },
  })
}
```

- [x] Tạo `src/features/incidents/hooks/use-create-appeal.ts`

### Task 5: Component — `AppealDialog.tsx`

File: `src/features/incidents/components/AppealDialog.tsx`

Props: `{ open, onOpenChange, incidentId, tenantId, currentUserId }`

```typescript
interface AppealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId: string
  tenantId: string | null
  currentUserId: string | undefined
}
```

Structure (mirror `CreateIncidentDialog.tsx`):
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` từ shadcn/ui
- Form với `react-hook-form` + `zodResolver(createAppealSchema)`
- `DialogTitle`: "Gửi Appeal"
- `DialogDescription`: "Trình bày quan điểm của bạn về incident này. Appeal không thể chỉnh sửa sau khi gửi."
- **Response Textarea:** `rows={5}`, placeholder "Trình bày quan điểm của bạn về sự việc này...", max 2000 ký tự
- Submit: `createAppeal.mutate({ tenantId, incidentId, memberId: currentUserId, response })`
- Disable submit khi `createAppeal.isPending`
- Close dialog sau `onSuccess` (truyền qua mutate options)
- Reset form khi `!open` (useEffect giống CreateIncidentDialog)
- Button Cancel: variant="outline", Button Submit: variant="default"

- [x] Tạo `src/features/incidents/components/AppealDialog.tsx`

### Task 6: Modify IncidentList — `IncidentList.tsx`

**Thay đổi props interface — thêm `appeals` và `currentUserId`:**

```typescript
interface IncidentListProps {
  incidents: Incident[]
  isLoading: boolean
  members: TenantMemberWithUser[]
  userTimezone: string | null
  appeals: IncidentAppeal[]         // MỚI
  currentUserId: string | undefined  // MỚI — để check can appeal
  canAppeal: boolean                 // MỚI — false nếu manager/owner
  onAppeal: (incidentId: string) => void  // MỚI — callback mở dialog
}
```

**Import thêm:**
```typescript
import type { IncidentAppeal } from '@/features/incidents/services/incident.service'
import { Button } from '@/components/ui/button'
```

**Trong render mỗi incident card**, thêm sau phần note:

```typescript
// Tìm appeal cho incident này
const appeal = appeals.find((a) => a.incident_id === incident.id)

// Appeal status section (chỉ hiển thị khi member đang xem — !canCreateIncident không đủ,
// dùng prop canAppeal từ usePermissions trong parent)
{canAppeal && (
  appeal ? (
    // Đã có appeal — hiển thị response
    <div className='mt-2 rounded-md bg-muted/50 border px-3 py-2 space-y-1'>
      <p className='text-xs font-medium text-muted-foreground'>Appeal của bạn:</p>
      <p className='text-sm'>{appeal.response}</p>
    </div>
  ) : (
    // Chưa appeal — hiển thị button
    <Button
      size='sm'
      variant='outline'
      className='mt-2 h-7 text-xs'
      onClick={() => onAppeal(incident.id)}
    >
      Gửi Appeal
    </Button>
  )
)}

{/* Manager cũng thấy appeal của member (nếu có) — không thấy button */}
{!canAppeal && appeal && (
  <div className='mt-2 rounded-md bg-muted/50 border px-3 py-2 space-y-1'>
    <p className='text-xs font-medium text-muted-foreground'>
      Appeal từ {getMemberName(members, appeal.member_id)}:
    </p>
    <p className='text-sm'>{appeal.response}</p>
  </div>
)}
```

**Badge appeal status** trong header row (chỉ cho manager view):
```typescript
{!canAppeal && (
  <Badge variant={appeal ? 'secondary' : 'outline'} className='text-xs'>
    {appeal ? 'Đã appeal' : 'Chưa appeal'}
  </Badge>
)}
```

- [x] Modify `src/features/incidents/components/IncidentList.tsx`

### Task 7: Modify Route — `src/routes/_app/incidents/index.tsx`

**Thêm imports:**
```typescript
import { useAppeals } from '@/features/incidents/hooks/use-appeals'
import { AppealDialog } from '@/features/incidents/components/AppealDialog'
import { usePermissions } from '@/hooks/use-permissions'
```

**Thêm trong component:**
```typescript
const { canCreateIncident } = usePermissions()

// Appeals — fetch cho cả member (chỉ thấy của mình qua RLS) và manager (thấy tất cả)
const { data: appeals = [] } = useAppeals(activeTenantId)

// Dialog state cho appeal (1 incident tại 1 thời điểm)
const [appealIncidentId, setAppealIncidentId] = useState<string | null>(null)
```

**Thêm props vào IncidentList:**
```typescript
<IncidentList
  incidents={incidents}
  isLoading={isIncidentsLoading}
  members={members}
  userTimezone={timezone}
  appeals={appeals}
  currentUserId={user?.id}
  canAppeal={!canCreateIncident}  // member = canAppeal; manager/owner = không
  onAppeal={(incidentId) => setAppealIncidentId(incidentId)}
/>
```

**Thêm AppealDialog (chỉ cho member):**
```typescript
{!canCreateIncident && (
  <AppealDialog
    open={!!appealIncidentId}
    onOpenChange={(open) => { if (!open) setAppealIncidentId(null) }}
    incidentId={appealIncidentId ?? ''}
    tenantId={activeTenantId}
    currentUserId={user?.id}
  />
)}
```

- [x] Modify `src/routes/_app/incidents/index.tsx`

### Task 8: Edge Function — `supabase/functions/notify-appeal/index.ts`

Pattern mirror `notify-incident/index.ts`. Thay đổi:
- Input: `{ incidentId, tenantId }` (không có `memberId` — lấy từ JWT)
- Verify: `incident.member_id === caller.id` (chỉ victim mới appeal)
- Query `incident.created_at` + `caller.full_name` cho notification message
- INSERT notification cho tất cả owner/manager trong tenant
- Notification type: `'appeal_submitted'`
- Message: `"${callerName} đã gửi appeal cho incident ngày ${formattedDate}."`
- `link_to: '/incidents'`

```typescript
// supabase/functions/notify-appeal/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { incidentId?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { incidentId, tenantId } = body
  if (!incidentId || !tenantId) {
    return new Response(JSON.stringify({ error: 'incidentId và tenantId là bắt buộc.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify incident tồn tại, thuộc tenant, và caller là victim
  const { data: incident, error: incidentError } = await supabaseAdmin
    .from('incidents')
    .select('id, created_at, member_id')
    .eq('id', incidentId)
    .eq('tenant_id', tenantId)
    .single()

  if (incidentError || !incident) {
    return new Response(JSON.stringify({ error: 'Incident không tồn tại.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (incident.member_id !== caller.id) {
    return new Response(JSON.stringify({ error: 'Forbidden — chỉ victim của incident mới được appeal.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Lấy full_name của caller
  const { data: callerProfile } = await supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', caller.id)
    .single()

  const callerName = callerProfile?.full_name ?? 'Thành viên'
  const incidentDate = new Date(incident.created_at)
  const formattedDate = `${String(incidentDate.getDate()).padStart(2, '0')}/${String(incidentDate.getMonth() + 1).padStart(2, '0')}/${incidentDate.getFullYear()}`

  // INSERT notification cho tất cả owner/manager trong tenant
  const { data: managers, error: managersError } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'manager'])
    .eq('status', 'active')
    .neq('user_id', caller.id)

  if (managersError || !managers?.length) {
    // Không có manager → không cần notify, trả về success
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const notifications = managers.map((m) => ({
    tenant_id: tenantId,
    user_id:   m.user_id,
    type:      'appeal_submitted' as const,
    message:   `${callerName} đã gửi appeal cho incident ngày ${formattedDate}.`,
    link_to:   '/incidents',
  }))

  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert(notifications)

  if (notifError) {
    console.error('[notify-appeal] notification insert error:', notifError)
    return new Response(JSON.stringify({ error: 'Không thể gửi thông báo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

- [x] Tạo `supabase/functions/notify-appeal/index.ts`

---

## Dev Notes

### Patterns tham khảo từ codebase

| Pattern | File tham khảo |
|---------|---------------|
| Dialog với react-hook-form | `src/features/incidents/components/CreateIncidentDialog.tsx` (mirror trực tiếp) |
| useMutation + invalidate | `src/features/incidents/hooks/use-create-incident.ts` |
| useQuery hook | `src/features/incidents/hooks/use-incidents.ts` |
| Edge Function với service role | `supabase/functions/notify-incident/index.ts` (mirror trực tiếp) |
| Notify managers pattern | `supabase/functions/notify-incident/index.ts` |
| `_shared/supabase-admin.ts` | Tất cả Edge Functions — import như cũ |
| `_shared/cors.ts` | Tất cả Edge Functions — import như cũ |

### Logic phân quyền trong IncidentList

```
canCreateIncident = true  → Manager/Owner
  → Hiển thị appeal badge status ("Đã appeal" / "Chưa appeal") + appeal response khi có
  → KHÔNG hiển thị "Gửi Appeal" button

canCreateIncident = false → Member
  → Hiển thị "Gửi Appeal" button (nếu chưa appeal)
  → Hiển thị appeal response của mình (nếu đã appeal)
  → KHÔNG hiển thị badge status
```

**Prop `canAppeal`:** = `!canCreateIncident` — được tính ở `index.tsx` trước khi pass xuống để giữ logic tập trung.

### RLS behavior tóm tắt

| Role | `incidents` SELECT | `incident_appeals` SELECT | `incident_appeals` INSERT |
|------|-------------------|--------------------------|--------------------------|
| Member | Chỉ incidents của mình | Chỉ appeals của mình | ✅ Cho mình, cho incident của mình |
| Manager | Tất cả incidents trong tenant | Tất cả appeals trong tenant | ❌ Không được |

### Không cần `$incidentId.tsx`

Story 7-2 KHÔNG tạo route detail page. Appeal là inline dialog trong `/incidents`. Story 7-3 sẽ tạo detail view cho Manager với audit trail đầy đủ.

### getIncidentAppeals query

RLS tự lọc — member nhận chỉ appeals của mình, manager nhận tất cả. Không cần filter thêm ở client.

### Appeal không cần optimistic update

Append-only data, DB constraint enforce uniqueness. Nếu submit bị lỗi duplicate → toast error. Không có rollback cần thiết.

### Project Structure Notes

- Feature folder: `src/features/incidents/` — đã tồn tại từ Story 7-1
- Không tạo barrel `index.ts` — import trực tiếp từ file (anti-pattern của project)
- Edge Function folder: `supabase/functions/notify-appeal/` — tạo mới (mirror `notify-incident/`)

### References

- [Source: _bmad-output/implementation-artifacts/7-1-log-incident.md#Lưu ý cho Story 7-2]
- [Source: supabase/migrations/20260323000010_create_incident_appeals.sql]
- [Source: supabase/migrations/20260323000011_rls_policies.sql#incident_appeals]
- [Source: supabase/functions/notify-incident/index.ts]
- [Source: src/features/incidents/] — toàn bộ code Story 7-1

---

## Anti-patterns cần tránh

- ❌ KHÔNG tạo `UPDATE` hoặc `DELETE` trên `incident_appeals` — immutable append-only
- ❌ KHÔNG tạo `$incidentId.tsx` trong story này — Story 7-3
- ❌ KHÔNG tạo barrel `index.ts` — import trực tiếp
- ❌ KHÔNG hardcode query key strings — dùng `QUERY_KEYS.incidentAppeals`
- ❌ KHÔNG `createClient()` lần 2 — import `supabase` từ `@/lib/supabase-browser`
- ❌ KHÔNG check role bằng string — dùng `usePermissions().canCreateIncident`
- ❌ KHÔNG fetch appeals bằng query mới khác pattern — follow `use-incidents.ts`
- ❌ KHÔNG tạo Edge Function mới để INSERT appeal — appeal INSERT trực tiếp từ client (RLS cho phép)
- ❌ KHÔNG dùng optimistic update cho appeals — không cần rollback

---

## Kiểm tra sau khi implement

- [ ] Member thấy danh sách incidents của mình (RLS tự lọc)
- [ ] Manager thấy tất cả incidents của team + appeal responses
- [ ] "Gửi Appeal" button chỉ xuất hiện cho member (không phải manager)
- [ ] Form appeal: response required, max 2000 ký tự
- [ ] Sau submit: appeal response xuất hiện trong card, "Gửi Appeal" button biến mất
- [ ] Thử submit appeal lần 2 cho cùng incident → error toast "Bạn đã gửi appeal rồi"
- [ ] Manager nhận notification type `appeal_submitted` sau khi member submit
- [ ] `npx supabase test db` PASS (không có migration mới)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- ESLint `no-console` violation trên cả `createIncident` (Story 7-1 carry-over) lẫn `createAppeal` mới → fixed bằng `// eslint-disable-next-line no-console`
- **Bug: Manager phải F5 mới thấy appeal** — 2 root causes: (1) `incident_appeals` không có trong `supabase_realtime` publication → không có Realtime event nào phát ra khi có INSERT mới. (2) `useAppeals` chỉ có `staleTime: 30s`, không có `refetchOnMount: 'always'` → nếu cache còn fresh (manager đã vào trang trước đó), sẽ không refetch khi navigate lại. Fix: migration `20260325000008` thêm `incident_appeals` vào publication với `REPLICA IDENTITY FULL`, tạo hook `use-incident-appeals-realtime.ts` subscribe trực tiếp vào INSERT event trên bảng → `invalidateQueries` ngay lập tức. Pattern giống `notifications` realtime đã hoạt động. — `notify-incident` bị `wall clock duration warning` + `early termination` trong edge runtime. Root cause: `supabaseAdmin.auth.getUser(jwt)` gọi HTTP đến GoTrue bên trong Docker; GoTrue reject JWT vì `iss` claim chứa external URL (`http://127.0.0.1:54321`) nhưng GoTrue tự nhận internal URL (`http://kong:8000`) → issuer mismatch → request hang → timeout. Fix: thay bằng `getUserFromJwt()` từ `_shared/jwt.ts` (decode payload trực tiếp, không HTTP call). Pattern này đã documented trong `notify-schedule-change`. Apply luôn cho `notify-appeal` để phòng ngừa cùng lỗi.

### Completion Notes List

- ✅ Task 1: Tạo `appeal.schema.ts` — Zod schema với validation min/max
- ✅ Task 2: Extended `incident.service.ts` — thêm `IncidentAppeal` type, `getIncidentAppeals`, `createAppeal` (best-effort notification)
- ✅ Task 3: Tạo `use-appeals.ts` — useQuery với `QUERY_KEYS.incidentAppeals`
- ✅ Task 4: Tạo `use-create-appeal.ts` — useMutation với duplicate detection trong onError
- ✅ Task 5: Tạo `AppealDialog.tsx` — mirror pattern `CreateIncidentDialog.tsx`, reset on close, submit truyền `onSuccess` callback
- ✅ Task 6: Modified `IncidentList.tsx` — thêm props `appeals`, `canAppeal`, `onAppeal`; appeal badge cho manager; appeal button/response cho member
- ✅ Task 7: Modified `incidents/index.tsx` — fetch appeals, permission check `canCreateIncident`, `AppealDialog` conditional render
- ✅ Task 8: Tạo `notify-appeal/index.ts` — Edge Function với verify victim ownership, format ngày dd/MM/yyyy, INSERT bulk notifications cho managers
- ✅ TypeScript check: 0 errors
- ✅ ESLint: 0 errors, 0 warnings
- ✅ DB tests: 63/63 PASS

### File List

- `src/features/incidents/schemas/appeal.schema.ts` (mới)
- `src/features/incidents/hooks/use-appeals.ts` (mới)
- `src/features/incidents/hooks/use-create-appeal.ts` (mới)
- `src/features/incidents/components/AppealDialog.tsx` (mới)
- `src/features/incidents/services/incident.service.ts` (sửa — thêm IncidentAppeal type + 2 methods + eslint-disable)
- `src/features/incidents/components/IncidentList.tsx` (sửa — thêm appeal UI cho member + manager)
- `src/routes/_app/incidents/index.tsx` (sửa — thêm appeals query, AppealDialog, canCreateIncident)
- `supabase/functions/notify-appeal/index.ts` (mới → sửa: getUserFromJwt thay supabaseAdmin.auth.getUser)
- `supabase/functions/notify-incident/index.ts` (sửa: getUserFromJwt thay supabaseAdmin.auth.getUser — fix notification bug)
- `supabase/migrations/20260325000008_realtime_incident_appeals.sql` (mới — fix realtime)
- `src/features/incidents/hooks/use-incident-appeals-realtime.ts` (mới — fix realtime)
