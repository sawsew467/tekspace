# Story 8.14: Tenant Avatar / Logo Upload

Status: done

## Story

Là một Owner hoặc Manager,
Tôi muốn upload logo cho team và hiển thị logo đó trong TeamSwitcher ở sidebar,
để nhận diện team dễ dàng hơn, đặc biệt khi user là thành viên của nhiều tenant.

## Acceptance Criteria

1. **AC1 — Migration schema:** Column `logo_url text` được thêm vào bảng `public.tenants` (nullable).
2. **AC2 — Storage bucket tồn tại:** Bucket `tenant-logos` (public read, 5MB, JPEG/PNG/WebP) được tạo với RLS policies đúng — chỉ owner/manager của tenant đó mới upload/delete được.
3. **AC3 — Upload tại team/settings:** Tại `/team/settings`, có Card "Logo nhóm" (hiển thị TRƯỚC form cài đặt) cho phép upload logo → preview crop vuông → lưu vào bucket + cập nhật `tenants.logo_url`.
4. **AC4 — Crop to square:** UI crop ảnh về 1:1 bằng HTML5 Canvas (256×256px) — không cần thư viện mới (reuse pattern từ `AvatarUploadCard`).
5. **AC5 — Xóa logo:** Có nút "Xóa logo" — xóa file từ Storage + set `tenants.logo_url = null` + fallback về icon `Building2`.
6. **AC6 — TeamSwitcher hiển thị logo thật:** `TeamSwitcher` nhận `logoUrl?: string | null`; khi có URL → hiển thị `<img>` thay vì icon `Building2`; khi null/undefined → fallback về icon như cũ.
7. **AC7 — Sidebar cập nhật tự động:** Sau upload thành công, sidebar TeamSwitcher tự cập nhật logo mà không cần reload trang (invalidate query).
8. **AC8 — Không regression:** `tsc -b` + `vite build` 0 errors. Fallback icon `Building2` vẫn hoạt động đúng cho tenant chưa có logo.

## Tasks / Subtasks

- [x] **Task 1: Migration** — thêm `logo_url` column + tạo `tenant-logos` bucket (AC1, AC2)
  - [x] Tạo `supabase/migrations/20260325000013_add_tenant_logo.sql`
  - [x] `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;`
  - [x] Tạo SECURITY DEFINER helper `public.is_tenant_manager_or_owner(p_tenant_id uuid) → boolean` để dùng trong storage RLS
  - [x] INSERT INTO `storage.buckets`: `id='tenant-logos'`, `public=true`, `file_size_limit=5242880`, `allowed_mime_types=['image/jpeg','image/png','image/webp']`
  - [x] RLS policy INSERT: authenticated + `is_tenant_manager_or_owner(path[1]::uuid)` (path `{tenantId}/{filename}`)
  - [x] RLS policy SELECT: public
  - [x] RLS policy UPDATE: authenticated + `is_tenant_manager_or_owner(path[1]::uuid)`
  - [x] RLS policy DELETE: authenticated + `is_tenant_manager_or_owner(path[1]::uuid)`
  - [x] `npx supabase db push --local` + `npx supabase test db` PASS

- [x] **Task 2: Service** — thêm logo functions vào `tenant.service.ts` (AC3, AC5)
  - [x] Thêm `logo_url?: string | null` vào `TenantSettings` type
  - [x] Cập nhật `getTenantSettings()` SELECT để include `logo_url`
  - [x] Thêm `uploadTenantLogoFile(tenantId, file)` → upload `tenant-logos/{tenantId}/{timestamp}.{ext}` → return public URL
  - [x] Thêm `updateTenantLogoUrl(tenantId, logoUrl)` → UPDATE `tenants.logo_url`
  - [x] Thêm `deleteTenantLogo(tenantId, currentLogoUrl?)` → xóa Storage file (best-effort) + set null
  - [x] Cập nhật RLS UPDATE policy cho `tenants`: verify owner/manager có thể UPDATE `logo_url`

- [x] **Task 3: Hook** — tạo `use-upload-tenant-logo.ts` (AC3, AC5, AC7)
  - [x] Tạo `src/features/tenant/hooks/use-upload-tenant-logo.ts`
  - [x] `useUploadTenantLogo()` → useMutation: upload file → update DB → invalidate cache
  - [x] `useDeleteTenantLogo()` → useMutation: delete storage + set null → invalidate cache
  - [x] Invalidate: `[QUERY_KEYS.tenantSettings, activeTenantId]` + `[QUERY_KEYS.tenantNames]` (để sidebar cập nhật)
  - [x] Toast: 'Đã cập nhật logo nhóm' / 'Đã xóa logo nhóm' / 'Không thể upload. Vui lòng thử lại.'

- [x] **Task 4: Component** — tạo `TenantLogoUploadCard.tsx` (AC3, AC4)
  - [x] Tạo `src/features/tenant/components/TenantLogoUploadCard.tsx`
  - [x] Hiển thị logo hiện tại: nếu `logoUrl` → `<img src={logoUrl} className="size-20 rounded-lg object-cover" />`; ngược lại → `<Building2 className="size-16 text-muted-foreground" />`
  - [x] Click vào logo/button → trigger `<input type="file" accept="image/jpeg,image/png,image/webp">` (hidden)
  - [x] Sau khi chọn file: crop bằng canvas 256×256 (reuse `cropImageToSquare` logic từ `AvatarUploadCard`) → hiển thị Dialog preview
  - [x] Dialog: preview image + nút "Lưu" + nút "Hủy"
  - [x] Nút "Xóa logo" chỉ hiện khi `logoUrl !== null` → gọi `useDeleteTenantLogo()`
  - [x] Spinner khi `isPending`

- [x] **Task 5: Apply vào team/settings page** (AC3)
  - [x] Tại `src/routes/_app/team/settings.tsx`, thêm `<TenantLogoUploadCard>` TRƯỚC `<Form>`
  - [x] Truyền `logoUrl={settings?.logo_url ?? null}` và `teamName={settings?.name ?? ''}` vào component
  - [x] Không cần guard thêm — page đã protected bởi `manageTenant` permission trong `beforeLoad`

- [x] **Task 6: Cập nhật TeamSwitcher** (AC6)
  - [x] Mở `src/components/layout/team-switcher.tsx`
  - [x] Thêm `logoUrl?: string | null` vào `Team` type
  - [x] Thay render `<activeTeam.logo className='size-8' />` bằng conditional:
    - Nếu `activeTeam.logoUrl` → `<img src={activeTeam.logoUrl} className="size-8 rounded-lg object-cover" />`
    - Ngược lại → `<activeTeam.logo className='size-8' />`
  - [x] Tương tự trong dropdown list item (size-4 thay vì size-8)

- [x] **Task 7: Cập nhật sidebar để fetch logo_url** (AC6, AC7)
  - [x] Tại `src/components/layout/app-sidebar.tsx`, thêm `logo_url` vào SELECT trong `tenantNames` query:
    ```ts
    .select('id, name, logo_url')
    ```
  - [x] Update kiểu `tenantRecords` (inline cast hoặc explicit type)
  - [x] Update `teams` array map:
    ```ts
    logoUrl: tenantRecords?.find((r) => r.id === t.tenantId)?.logo_url ?? null,
    ```

- [x] **Task 8: Verify** (AC8)
  - [x] `tsc -b` — 0 errors trong các file của story này
  - [x] `vite build` — success
  - [x] Upload logo → hiển thị ngay trong sidebar TeamSwitcher + team/settings card
  - [x] Xóa logo → icon `Building2` fallback hoạt động đúng
  - [x] Tenant không có logo → sidebar vẫn hiển thị `Building2` như cũ (không regression)

---

## Dev Notes

### ⚠️ DATABASE: `logo_url` chưa tồn tại — bắt buộc migration

MCP verify: `tenants` table hiện tại (2026-03-25) có columns: `id, name, timezone, schedule_deadline_day, schedule_deadline_hour, daily_report_deadline_hour, default_committed_hours, created_at, updated_at, reminder_days`.

**`logo_url` CHƯA CÓ** → bắt buộc migration.

---

### Task 1 Chi tiết: Migration SQL

```sql
-- supabase/migrations/20260325000013_add_tenant_logo.sql
-- Story: 8-14-tenant-avatar-logo

-- ================================================================
-- 1. Thêm cột logo_url vào tenants
-- ================================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ================================================================
-- 2. SECURITY DEFINER helper để storage RLS kiểm tra tenant role
-- Cần thiết vì storage.objects policies không thể dùng inline
-- subquery vào bảng có RLS (vi phạm CLAUDE.md RLS rules)
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_manager_or_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND status = 'active'
  );
$$;

-- ================================================================
-- 3. Storage bucket tenant-logos
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 4. RLS Policies cho bucket tenant-logos
-- Path pattern: {tenantId}/{filename}
-- Chỉ owner/manager của tenant đó mới được write
-- ================================================================

-- Public read (bucket đã public=true)
CREATE POLICY "tenant_logos_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tenant-logos');

-- Insert: authenticated + là manager/owner của tenant
CREATE POLICY "tenant_logos_insert_manager"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);

-- Update: authenticated + là manager/owner của tenant
CREATE POLICY "tenant_logos_update_manager"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);

-- Delete: authenticated + là manager/owner của tenant
CREATE POLICY "tenant_logos_delete_manager"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);
```

**Lưu ý SECURITY DEFINER:** Function `is_tenant_manager_or_owner` cần `SECURITY DEFINER SET search_path = ''` để tránh infinite recursion khi query `tenant_members` (có RLS) từ trong storage policy. Đây là pattern bắt buộc theo CLAUDE.md.

---

### Task 2 Chi tiết: Service Functions

Thêm vào `src/features/tenant/services/tenant.service.ts`:

```typescript
// ================================================================
// Story 8-14: Tenant Logo Upload
// ================================================================

// Cập nhật TenantSettings type — thêm logo_url
export type TenantSettings = {
  id: string
  name: string
  timezone: string
  schedule_deadline_day: number
  schedule_deadline_hour: number
  daily_report_deadline_hour: number
  default_committed_hours: number
  reminder_days: number[]
  logo_url: string | null  // ← THÊM MỚI (Story 8-14)
}

// Cập nhật getTenantSettings() — thêm logo_url vào SELECT
// Đổi .select('id, name, timezone, ..., reminder_days') → thêm ', logo_url'

// Hàm upload logo lên Storage, return public URL
export const uploadTenantLogoFile = async (tenantId: string, file: File): Promise<string> => {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${tenantId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('tenant-logos')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('tenant-logos').getPublicUrl(path)
  return data.publicUrl
}

// Cập nhật logo_url trong tenants table
export const updateTenantLogoUrl = async (
  tenantId: string,
  logoUrl: string | null
): Promise<void> => {
  const { data, error } = await supabase
    .from('tenants')
    .update({ logo_url: logoUrl })
    .eq('id', tenantId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update blocked — check RLS or session')
}

// Xóa logo: xóa file storage (best-effort) + set null
export const deleteTenantLogo = async (
  tenantId: string,
  currentLogoUrl: string | null
): Promise<void> => {
  if (currentLogoUrl) {
    try {
      const urlObj = new URL(currentLogoUrl)
      const pathMatch = urlObj.pathname.match(/\/tenant-logos\/(.+)/)
      if (pathMatch?.[1]) {
        await supabase.storage.from('tenant-logos').remove([decodeURIComponent(pathMatch[1])])
      }
    } catch {
      // Best-effort: không throw nếu file không tồn tại hoặc URL invalid
    }
  }
  await updateTenantLogoUrl(tenantId, null)
}
```

**Lưu ý:** `updateTenantLogoUrl` dùng pattern `.select('id').single()` để detect silent RLS block (như tất cả update functions khác trong codebase).

---

### Task 3 Chi tiết: Hook

```typescript
// src/features/tenant/hooks/use-upload-tenant-logo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { uploadTenantLogoFile, updateTenantLogoUrl, deleteTenantLogo } from '../services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'

export const useUploadTenantLogo = () => {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (croppedBlob: Blob) => {
      if (!activeTenantId) throw new Error('No active tenant')
      const file = new File([croppedBlob], 'logo.jpg', { type: 'image/jpeg' })
      const publicUrl = await uploadTenantLogoFile(activeTenantId, file)
      await updateTenantLogoUrl(activeTenantId, publicUrl)
    },
    onSuccess: () => {
      toast.success('Đã cập nhật logo nhóm')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantSettings, activeTenantId] })
      // Invalidate tenantNames để sidebar TeamSwitcher cập nhật logo
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantNames] })
    },
    onError: () => {
      toast.error('Không thể upload logo. Vui lòng thử lại.')
    },
  })
}

export const useDeleteTenantLogo = () => {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (currentLogoUrl: string | null) => {
      if (!activeTenantId) throw new Error('No active tenant')
      await deleteTenantLogo(activeTenantId, currentLogoUrl)
    },
    onSuccess: () => {
      toast.success('Đã xóa logo nhóm')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantSettings, activeTenantId] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantNames] })
    },
    onError: () => {
      toast.error('Không thể xóa logo. Vui lòng thử lại.')
    },
  })
}
```

---

### Task 4 Chi tiết: Component TenantLogoUploadCard

**Reuse hoàn toàn pattern từ `AvatarUploadCard.tsx`** — copy-adapt, không import từ settings feature (tránh cross-feature coupling).

```tsx
// src/features/tenant/components/TenantLogoUploadCard.tsx
// Props: logoUrl: string | null, teamName: string
// Internal state: previewBlob: Blob | null, dialogOpen: boolean
//
// cropImageToSquare() — copy y chang từ AvatarUploadCard (canvas 256×256 center crop)
//
// Layout:
// <Card>
//   <CardHeader> <CardTitle>Logo nhóm</CardTitle> </CardHeader>
//   <CardContent>
//     <div className="flex items-center gap-4">
//       <div
//         className="size-20 rounded-lg overflow-hidden flex items-center justify-center
//                    border bg-muted cursor-pointer"
//         onClick={openFilePicker}
//       >
//         {logoUrl
//           ? <img src={logoUrl} className="size-20 object-cover" alt="Team logo" />
//           : <Building2 className="size-10 text-muted-foreground" />
//         }
//       </div>
//       <div className="space-y-2">
//         <Button variant="outline" size="sm" onClick={openFilePicker}>Chọn logo</Button>
//         {logoUrl && (
//           <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
//             Xóa logo
//           </Button>
//         )}
//       </div>
//     </div>
//     <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
//            className="hidden" onChange={handleFileChange} />
//   </CardContent>
// </Card>
//
// <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
//   <DialogContent>
//     <DialogHeader><DialogTitle>Xem trước logo</DialogTitle></DialogHeader>
//     {previewUrl && (
//       <img src={previewUrl} className="w-64 h-64 object-cover rounded-lg mx-auto" alt="Preview" />
//     )}
//     <DialogFooter>
//       <Button variant="outline" onClick={handleCancel}>Hủy</Button>
//       <Button onClick={handleSave} disabled={uploadMutation.isPending}>
//         {uploadMutation.isPending ? 'Đang tải...' : 'Lưu'}
//       </Button>
//     </DialogFooter>
//   </DialogContent>
// </Dialog>
```

**Lưu ý quan trọng:**
- Dùng `Building2` icon từ `lucide-react` (cùng icon với sidebar hiện tại)
- Không dùng `<Avatar>` component của shadcn — logo team hiển thị dạng rectangle rounded, không phải circle
- `previewUrl` = `URL.createObjectURL(previewBlob)` — cleanup với `URL.revokeObjectURL()` khi dialog đóng

---

### Task 6 Chi tiết: TeamSwitcher Update

```typescript
// src/components/layout/team-switcher.tsx

// Cập nhật Team type
type Team = {
  id: string
  name: string
  logo: React.ElementType   // ← giữ nguyên — fallback icon
  logoUrl?: string | null   // ← THÊM MỚI (optional, tương thích ngược)
  plan: string
}

// Trong render: active team button
<div className='flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg'>
  {activeTeam.logoUrl
    ? <img src={activeTeam.logoUrl} className='size-8 object-cover' alt={activeTeam.name} />
    : <activeTeam.logo className='size-8' />
  }
</div>

// Trong dropdown list item
<div className='flex size-6 items-center justify-center rounded-sm border overflow-hidden'>
  {team.logoUrl
    ? <img src={team.logoUrl} className='size-6 object-cover' alt={team.name} />
    : <team.logo className='size-4 shrink-0' />
  }
</div>
```

---

### Task 7 Chi tiết: Sidebar tenantNames Query Update

```typescript
// src/components/layout/app-sidebar.tsx

// Cập nhật query: thêm logo_url vào SELECT
const { data: tenantRecords } = useQuery({
  queryKey: [QUERY_KEYS.tenantNames, tenantIds],
  queryFn: async () => {
    if (tenantIds.length === 0) return []
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, logo_url')  // ← thêm logo_url
      .in('id', tenantIds)
    if (error) throw error
    return data ?? []
  },
  enabled: tenantIds.length > 0,
  staleTime: 5 * 60 * 1000,
})

// Cập nhật teams array
const teams = tenants.map((t) => ({
  id: t.tenantId,
  name: tenantRecords?.find((r) => r.id === t.tenantId)?.name ?? 'Loading...',
  logo: Building2,
  logoUrl: tenantRecords?.find((r) => r.id === t.tenantId)?.logo_url ?? null,  // ← THÊM
  plan: t.role,
}))
```

---

### RLS Tenant Table: Verify UPDATE Permission

Bảng `tenants` hiện có policy kiểm tra owner/manager. Cần verify `updateTenantLogoUrl` (UPDATE `tenants`) được phép với manager role. Dựa trên `updateTenantSettings` trong `tenant.service.ts` đang hoạt động tốt với mutation → policy hiện tại đã cho phép UPDATE `tenants` với điều kiện là owner/manager. **Không cần thêm migration cho tenants RLS.**

---

### Naming Conventions

| Element | Convention | Value |
|---------|-----------|-------|
| Migration | `YYYYMMDDNNNNNN_description.sql` | `20260325000013_add_tenant_logo.sql` |
| Storage bucket | lowercase, kebab | `tenant-logos` |
| Storage path | `{tenantId}/{timestamp}.{ext}` | `abc-uuid/1711234567890.jpg` |
| Service functions | camelCase, verb-first | `uploadTenantLogoFile`, `updateTenantLogoUrl`, `deleteTenantLogo` |
| Hook file | `src/features/tenant/hooks/use-upload-tenant-logo.ts` | — |
| Component file | `src/features/tenant/components/TenantLogoUploadCard.tsx` | — |

---

### Validation & Error Cases

| Case | Handling |
|------|---------|
| File > 5MB | Supabase Storage trả lỗi → toast.error |
| File type không hợp lệ | `<input accept="...">` lọc UI; Storage policy chặn server |
| User không phải owner/manager | storage RLS từ chối (`is_tenant_manager_or_owner` → false) → toast.error |
| Upload thành công nhưng DB update fail | Storage có file nhưng `tenants.logo_url` không đổi → user retry |
| URL không load được | Fallback `<Building2>` icon hiển thị (onerror handler hoặc conditional) |
| Tenant không có logo | `logoUrl = null` → icon Building2; nút "Xóa logo" ẩn |
| path[1]::uuid cast fail trong storage RLS | Policy từ chối (exception = denied) — path phải đúng format |

---

### Checklist Trước Khi Done

- [ ] `npx supabase db push --local` — migration apply thành công
- [ ] `npx supabase test db` — tất cả PASS (không có `not ok`)
- [ ] Upload logo tại `/team/settings` → hiển thị trong card + sidebar TeamSwitcher
- [ ] Xóa logo → icon Building2 fallback trong card + sidebar
- [ ] Tenant khác chưa có logo → sidebar vẫn hiển thị Building2 (không regression)
- [ ] `tsc -b` — 0 errors trong các file của story này
- [ ] `vite build` — success

---

## Dev Agent Record

### Implementation Plan

**Story 8-14: Tenant Avatar / Logo Upload** — Implemented 2026-03-25

**Approach:**
- Task 1: Tạo migration `20260325000013_add_tenant_logo.sql` — thêm `logo_url text` column vào `tenants`, tạo SECURITY DEFINER helper `is_tenant_manager_or_owner()`, tạo storage bucket `tenant-logos` (public, 5MB, JPEG/PNG/WebP), 4 RLS policies (SELECT public, INSERT/UPDATE/DELETE chỉ owner/manager)
- Task 2: Cập nhật `TenantSettings` type thêm `logo_url`, UPDATE select query, thêm 3 functions: `uploadTenantLogoFile`, `updateTenantLogoUrl`, `deleteTenantLogo`
- Task 3: Hook `use-upload-tenant-logo.ts` với `useUploadTenantLogo` + `useDeleteTenantLogo`, invalidate cả `tenantSettings` + `tenantNames` queries
- Task 4: Component `TenantLogoUploadCard.tsx` — reuse `cropImageToSquare` pattern từ `AvatarUploadCard`, dialog preview, conditional logo/Building2 display
- Task 5: Inject `TenantLogoUploadCard` vào `team/settings.tsx` trước Form
- Task 6: Update `TeamSwitcher` — thêm `logoUrl?` vào Team type, conditional render img vs icon trong active button + dropdown list
- Task 7: Update `app-sidebar.tsx` — thêm `logo_url` vào SELECT, map `logoUrl` vào teams array
- Task 8: Regenerate `supabase-types.ts` để TS types phản ánh migration mới → tsc 0 errors trong story files + vite build success

**Key decisions:**
- Dùng `SECURITY DEFINER SET search_path = ''` trên `is_tenant_manager_or_owner()` theo CLAUDE.md RLS checklist để tránh infinite recursion
- Regenerate `src/lib/supabase-types.ts` (không phải `database.types.ts`) vì đây là file supabase client import
- `updateTenantLogoUrl` dùng `.select('id').single()` pattern để detect silent RLS block (consistent với codebase)

### Completion Notes

✅ **Tất cả 8 tasks hoàn thành** — 2026-03-25

- **Migration**: `20260325000013_add_tenant_logo.sql` — `logo_url` column + `tenant-logos` bucket + 4 storage RLS policies + SECURITY DEFINER helper
- **DB Tests**: 80 tests PASS (`npx supabase test db`)
- **Service**: 3 functions mới trong `tenant.service.ts` + type updated + SELECT updated
- **Hook**: `use-upload-tenant-logo.ts` với upload + delete mutations, toast messages, query invalidation
- **Component**: `TenantLogoUploadCard.tsx` — canvas crop 256×256, dialog preview, fallback Building2
- **Settings page**: `TenantLogoUploadCard` được render trước Form
- **TeamSwitcher**: Conditional `<img>` vs icon cho cả active button và dropdown items
- **Sidebar**: `logo_url` trong tenantNames query, `logoUrl` trong teams map
- **TypeScript**: 0 errors trong story files sau regenerate `supabase-types.ts`
- **Vite build**: Success

---

## File List

**New files:**
- `supabase/migrations/20260325000013_add_tenant_logo.sql`
- `src/features/tenant/hooks/use-upload-tenant-logo.ts`
- `src/features/tenant/components/TenantLogoUploadCard.tsx`

**Modified files:**
- `src/features/tenant/services/tenant.service.ts` (thêm `logo_url` vào `TenantSettings` type + `getTenantSettings` SELECT + 3 logo functions mới)
- `src/routes/_app/team/settings.tsx` (thêm `TenantLogoUploadCard` import + component)
- `src/components/layout/team-switcher.tsx` (thêm `logoUrl` vào Team type + conditional render)
- `src/components/layout/app-sidebar.tsx` (thêm `logo_url` vào tenantNames query SELECT + teams map)
- `src/lib/supabase-types.ts` (regenerated — thêm `logo_url` vào tenants type)
- `_bmad-output/implementation-artifacts/8-14-tenant-avatar-logo.md` (file này)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status → review)
