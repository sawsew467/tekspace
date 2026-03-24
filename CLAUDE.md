# TekSpace — Hướng dẫn cho AI Agent

## Stack

- **Frontend**: Vite + React + TypeScript + TanStack Router
- **State/Data**: TanStack Query (React Query) + TanStack Table
- **UI**: shadcn/ui (Radix UI + Tailwind CSS)
- **Backend**: Supabase (PostgreSQL + RLS + Auth + Edge Functions trên Deno)
- **Auth**: Supabase Auth — JWT với custom claims `active_tenant_id`, `tenant_roles`
- **Multi-tenant**: Row-level isolation qua `current_tenant_id()` helper đọc JWT

## Database & RLS

### Trước khi viết code có query DB → dùng MCP verify

```
mcp: list_tables()                        → xem toàn bộ tables
mcp: get_table_schema('public.<table>')   → verify column tồn tại
```

Nếu column chưa có → viết migration trước → apply → rồi mới code.

### Khi viết migration mới có RLS — checklist bắt buộc

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` đã có
- [ ] Mọi helper function query bảng có RLS → phải có `SECURITY DEFINER SET search_path = ''`
- [ ] SELECT policy: không dùng inline subquery vào bảng khác có RLS (dùng SECURITY DEFINER function thay thế)
- [ ] INSERT policy: có `WITH CHECK` đủ điều kiện
- [ ] Tenant isolation: mọi policy đều có `tenant_id = public.current_tenant_id()`

### Các lỗi RLS phổ biến

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `stack depth limit exceeded` / infinite recursion | Helper function query bảng có RLS mà không có `SECURITY DEFINER` | Thêm `SECURITY DEFINER SET search_path = ''` |
| User thấy data tenant khác | Thiếu `tenant_id = current_tenant_id()` | Thêm tenant isolation check |
| INSERT/UPDATE không bị chặn đúng | `WITH CHECK` thiếu điều kiện | Bổ sung policy |
| Policy không kích hoạt | Quên `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Thêm vào migration |

### Test RLS — 2 tầng bắt buộc

**Tầng 1 — Inline (trong lúc dev, dùng MCP):**
```sql
-- Test với member role (role thấp nhất — hay bị bỏ qua nhất)
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{
  "sub": "<user_id>",
  "role": "authenticated",
  "active_tenant_id": "<tenant_id>"
}';
SELECT * FROM <table> WHERE ...;  -- verify kết quả đúng
ROLLBACK;
```
Test tối thiểu: **owner** + **member**. Owner pass mà member fail = có bug RLS.

**Tầng 2 — Formal test suite (trước khi mark story done):**
```bash
npx supabase test db
```
Chạy toàn bộ `supabase/tests/*.sql`. Tất cả phải PASS. Nếu có `not ok` → fix migration → chạy lại.

### Apply migration

```bash
# Thêm migration mới (không xóa data)
npx supabase db push --local

# Reset toàn bộ DB về trạng thái sạch (xóa hết data local)
npx supabase db reset   # chỉ dùng khi migration có conflict hoặc cần seed lại
```

## Quy tắc chung

- Migration files: `supabase/migrations/YYYYMMDD_description.sql`
- Không push lên Supabase remote production khi đang dev local
- Mỗi story có thay đổi DB → `npx supabase test db` phải pass trước khi done
