# Kế hoạch triển khai — Usage Tracking UI (trong tekspace)

> Trạng thái: PLAN đã chốt qua discuss — chưa code.
> Phạm vi project này: **chỉ phần web** trong repo `tekspace` — (1) quản lý token, (2) dashboard đọc usage từ Supabase, (3) Edge Function nhận request từ CLI.
> Ngoài phạm vi: hooks/statusline/token-gate phía CLI (dự án khác lo).

---

## 0. Quyết định đã chốt

| Chủ đề | Chốt |
|---|---|
| Nơi ở | Nhúng vào `tekspace`, tái dùng Supabase + Auth + RLS + shadcn (không dựng Next.js) |
| Danh tính | Tái dùng `users` + `tenant_members` sẵn có (KHÔNG tạo `team_members`). Token map `user_id`, 1 user nhiều token |
| Phân quyền xem | Mọi member trong tenant xem được usage cả team |
| Dashboard | Stat card + area chart (token theo thời gian, stack theo dev) + bảng team (TanStack Table) |
| Chi tiết dev | Row click → drawer lịch sử snapshot/branch/phiên |
| Token page | Sinh (hiện 1 lần) · danh sách · revoke · label — nằm trong nhóm Account |
| Điều hướng | `/usage` ở menu chính; token trong Account/Security |
| Cost | Vẫn hiện, kèm nhãn "ước tính" + tooltip (theo mục 8 doc gốc) |
| Realtime | Bật trên `usage_snapshots` để bảng live |
| Thứ tự làm | **Làm trọn từng tính năng** (DB+UI xong hẳn 1 feature rồi sang feature kế) |

---

## 1. Data model (mới, tenant-scoped)

```sql
device_tokens (
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references users,
  tenant_id uuid not null references tenants,
  token_hash text not null,        -- sha256 của token thô; KHÔNG lưu token thô
  token_prefix text not null,      -- vài ký tự đầu (vd 'cku_a1b2') để hiển thị nhận diện
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  revoked_at timestamptz
)

claude_sessions (
  session_id text pk,
  user_id uuid not null references users,
  tenant_id uuid not null references tenants,
  model text, project text, branch text,
  started_at timestamptz, last_seen_at timestamptz default now()
)

usage_snapshots (
  id bigint generated always as identity pk,
  session_id text references claude_sessions,
  user_id uuid not null references users,
  tenant_id uuid not null references tenants,
  context_percent int,
  input_tokens int, output_tokens int,
  cost_usd numeric,                -- ước tính, có thể null
  lines_added int, lines_removed int,
  active_plan text,
  five_hour_pct int, seven_day_pct int,
  idle boolean default false,
  created_at timestamptz default now()
)
```

### Checklist RLS (bắt buộc theo CLAUDE.md)
- [ ] `ENABLE ROW LEVEL SECURITY` cả 3 bảng.
- [ ] SELECT: `tenant_id = public.current_tenant_id()` → cả team đọc được.
- [ ] `device_tokens` INSERT/UPDATE (revoke): thêm điều kiện `user_id = auth.uid()` — chỉ chủ token thao tác.
- [ ] Helper query bảng có RLS → `SECURITY DEFINER SET search_path = ''`.
- [ ] `usage_snapshots` / `claude_sessions` KHÔNG cho client ghi trực tiếp — chỉ ghi qua Edge Function (service_role, bypass RLS).
- [ ] Bật realtime cho `usage_snapshots` (theo mẫu migration `enable_notifications_realtime`).

### RPC
- `create_device_token(p_label text)` → `SECURITY DEFINER`: sinh token thô bằng `gen_random_bytes`, prefix `cku_`, lưu `sha256` + prefix, **trả token thô đúng 1 lần**.
- `revoke_device_token(p_id uuid)` → set `revoked_at`, chỉ chủ token.

---

## 2. Edge Function `ingest-usage` (đầu nhận request CLI)

- Nhận `POST` + header `Authorization: Bearer cku_...`.
- Tính `sha256(token)` → tra `device_tokens` (`revoked_at is null`) → lấy `user_id`, `tenant_id`.
- Upsert `claude_sessions` (theo `session_id`) + insert `usage_snapshots`; update `last_used_at`.
- Dùng service_role trong function (bypass RLS) — token đã tự xác thực chủ.
- Trả 401 nếu token sai/thu hồi; fire-and-forget phía CLI nên chỉ cần status code gọn.

---

## 3. Tính năng & thứ tự (làm trọn từng cái)

### Feature 1 — Quản lý token  (`/_app/account/tokens.tsx`)
DB → UI xong hẳn rồi mới sang Feature 2.
1. Migration `device_tokens` + RLS + RPC create/revoke.
2. `npx supabase test db` (thêm test: chủ token revoke được, member khác không).
3. Route `account/tokens.tsx` + entry trong `account/route.tsx`:
   - Bảng token (label, prefix, tạo lúc, dùng cuối, trạng thái, [Revoke]).
   - Dialog tạo: nhập label → gọi RPC → màn "hiện 1 lần" + nút Copy + hướng dẫn dán `.claude/.env`.
   - Revoke qua AlertDialog xác nhận.
   - Dùng TanStack Query cho fetch/mutation; toast (sonner) khi copy/revoke.

### Feature 2 — Dashboard usage  (`/_app/usage.tsx`)
1. Migration `claude_sessions` + `usage_snapshots` + RLS + realtime.
2. Edge Function `ingest-usage` + test bằng `curl` (giả 1 token hợp lệ).
3. `npx supabase test db` (member A tenant X không thấy snapshot tenant Y).
4. Route `usage.tsx` + entry menu chính:
   - 3 stat card: tổng token · cost ước tính (⧉ tooltip) · số dev active.
   - Area chart (recharts): token theo thời gian, stack theo dev.
   - Bảng team (TanStack Table): Dev · Model · Project · Ctx% (progress, đỏ khi >80%) · Tokens · Cost · Trạng thái (Active/Idle Xm/Offline).
   - Realtime subscribe `usage_snapshots` → cập nhật bảng live.
   - Row click → Drawer: lịch sử snapshot, branch, phiên gần nhất của dev đó.

---

## 4. Không thêm dependency
Đã có sẵn: `@tanstack/react-table`, `@tanstack/react-query`, `recharts`, shadcn `dialog`/`alert-dialog`/`badge`/`progress`/`tooltip`, `sonner`, `@supabase/supabase-js`. Không cài gì mới.

## 5. Định nghĩa "Done" mỗi feature
- `npx supabase test db` PASS (owner + member).
- Không gọi mạng trên đường render; mutation/fetch qua React Query.
- Tenant isolation verify bằng MCP inline (owner + member).
