# Story 11.1: AI Import Daily Reports

Status: review
Epic: 11 — AI Import Daily Reports
Story ID: 11.1
Story Key: 11-1-ai-import-reports
Created: 2026-03-30

---

## Story

As an owner or manager,
I want to import daily reports from any chat platform export (Slack, Discord, MS Teams...)
so that my team has historical work data and members don't feel like they're "starting from scratch."

---

## Background

TekSpace's daily report system is valuable, but new teams have no history. Many teams
already track daily standups in Slack or Discord. Rather than losing that history, owner/manager
can paste chat export text and have AI parse it into TekSpace's structured format.

**Key requirement:** This feature must work for **any team** — not just the current one.
The import process is tenant-scoped, but the mechanism (paste → parse → map → import)
applies universally.

---

## Acceptance Criteria

**AC1:** User paste Slack text → click "Parse with AI 🤖" → thấy preview table với đúng data đã parse

**AC2:** LLM parse handle bất kỳ format nào (Slack, Discord, MS Teams...)

**AC3:** Unmapped authors → yellow badge → inline dropdown mapping

**AC4:** Mapping persist trong localStorage → import lần sau tự động apply

**AC5:** Owner chọn Skip (default) hoặc Overwrite trước khi import

**AC6:** Import button disabled khi còn unmapped author chưa được map

**AC7:** Owner có thể chọn "Import only mapped" → skip unmapped → warning hiện số reports bị skip

**AC8:** Upsert: skip → không ghi đè data hiện có; overwrite → xóa + insert mới

**AC9:** Audit log ghi: ai import, bao nhiêu rows, mode, thời gian

**AC10:** LLM parse fail → hiện error + "Retry" button, không crash UI

**AC11:** Sidebar hiện "Import" link chỉ khi role = owner hoặc manager

**AC12:** Hours logged = tổng hours tất cả tasks (completed + in_progress)

**AC13:** Empty sections (N/A) → không tạo task row

**AC14:** Nếu tất cả reports đều unmapped → Import button disabled + message: "Không có report nào được map. Vui lòng map author trước khi import."

---

## Tasks / Subtasks

- [x] T1 — Supabase Edge Function (LLM Parser) (AC: 2, 10)
  - [x] `supabase/functions/ai-parse/index.ts`
  - [x] OpenAI GPT-4o API call (system prompt in messages[0] as role: 'system')
  - [x] Zod schema validation on response
  - [x] Error handling: timeout, non-JSON, partial parse
  - [x] `OPENAI_API_KEY` secret set in Supabase dashboard

- [x] T2 — Frontend Types + User Mapping (AC: 3, 4, 12, 13)
  - [x] `src/features/ai-import/types/ai-parse.types.ts` — Zod schemas + interfaces
  - [x] `src/features/ai-import/lib/user-mapping.ts` — VN normalization + findBestMatch + localStorage persistence
  - [x] LRU cache: max 50 mappings

- [x] T3 — TanStack Query Hooks (AC: 1, 5, 6, 7, 8, 9, 14)
  - [x] `src/features/ai-import/hooks/use-ai-parse.ts` — useMutation calling edge function
  - [x] `src/features/ai-import/hooks/use-import-reports.ts` — useMutation calling RPC

- [x] T4 — Service Layer
  - [x] `src/features/ai-import/services/ai-import.service.ts`

- [x] T5 — UI Components (AC: 1, 3, 5, 6, 7, 14)
  - [x] `src/features/ai-import/components/ImportPage.tsx` — main page
  - [x] `src/features/ai-import/components/ImportPreviewTable.tsx` — preview table
  - [x] `src/features/ai-import/components/UserMappingModal.tsx` — mapping modal
  - [x] `src/features/ai-import/components/ImportResultSummary.tsx` — result cards

- [x] T6 — Routing + Layout (AC: 11)
  - [x] `src/routes/_app/admin/route.tsx` — AdminLayout with PageContainer
  - [x] `src/routes/_app/admin/import.tsx` — route definition + role guard (owner/manager only)

- [x] T7 — Sidebar Navigation (AC: 11)
  - [x] `src/components/layout/data/sidebar-data.ts` — add Upload icon nav item, role-gated ['owner', 'manager']
  - [x] `src/lib/routes.ts` — added `admin.import` route

- [x] T8 — Migration (AC: 8, 9, 12)
  - [x] `supabase/migrations/20260330_import_slack_rpc.sql`
  - [x] `import_slack_reports(p_reports, p_mode, p_tenant_id, p_import_only_mapped)` function
  - [x] SECURITY DEFINER + authorization check (tenant_id match + owner/manager only)
  - [x] Batching 50 rows/batch + error tracking in result.errors
  - [x] Audit log insert via `member_audit_logs` with action='ai_import'

- [x] T9 — Tests (before story done)
  - [x] Unit tests: ai-parse.types.test.ts (Z1–Z10, 15 tests), user-mapping.test.ts (M1–M8, L1–L5, 16 tests) — **31/31 PASS**
  - [x] RPC integration tests (R1–R10) — **10/10 PASS**
  - [x] RLS security tests (S1–S2) — owner✅ manager✅ member❌ wrong-tenant❌ — **2/2 PASS**
  - [x] All vitest regression tests: 351/351 PASS
  - [x] `psql ... -f supabase/tests/test_ai_import_rpc.sql` → **PASS**

---

## Dev Notes

### Architecture Context

- Feature folder: `src/features/ai-import/` (new)
- Feature is ADMIN-scoped: only visible to owner/manager
- Multi-tenant: RPC must check tenant_id from JWT, upsert with correct tenant_id
- Reuses: shadcn/ui components, TanStack Query, Supabase service pattern, localStorage

### Critical Technical Notes

1. **SECURITY DEFINER RPC:** `import_slack_reports` uses `SECURITY DEFINER SET search_path = ''`
   but STILL requires application-level auth check inside the function body.
   Do NOT rely on SECURITY DEFINER alone — it bypasses RLS but NOT app-level checks.

2. **System prompt placement:** Must be in `messages[0]` with `role: 'system'`, NOT in user content.
   Edge function will call: `https://api.openai.com/v1/chat/completions`

3. **VN normalization:** Author names may contain Vietnamese diacritics.
   Must normalize both author names and TekSpace user full names before matching.

4. **Hours calculation:** `hours_logged` = sum of ALL task hours (completed + in_progress).
   If no tasks → `hours_logged = 0`.

5. **Upsert logic:**
   - `skip`: INSERT only if no existing (date, user_id) pair exists
   - `overwrite`: DELETE existing + INSERT new

### Project Structure Notes

- Follow existing feature module structure: `services/`, `hooks/`, `components/`, `types/`, `lib/`
- Do NOT use barrel exports (index.ts)
- Use existing shadcn/ui: Button, Card, Table, Dialog, Select, Input, Label, Badge, Skeleton
- Use Upload icon from lucide-react for sidebar nav item
- Use `toast` from sonner for notifications (already in project)

### Code Patterns (from architecture.md)

```typescript
// Service — throw on error, return data directly
export const AiImportService = {
  parseReports: async (text: string) => { ... },
  importReports: async (reports, mode, tenantId) => { ... }
}

// Hook — useMutation with onSuccess invalidate
const { mutate, isPending } = useMutation({
  mutationFn: AiImportService.importReports,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })
})

// Route guard — beforeLoad role check
beforeLoad: ({ context }) => {
  if (!context.permissions.canManageTenant)
    throw redirect({ to: ROUTES.app.dashboard })
}

// localStorage persistence — JSON parse/stringify
const key = `import_mapping_${tenantId}`
localStorage.setItem(key, JSON.stringify(mapping))
```

### References

- Tech spec (sharded): `tech-spec-ai-import-reports/index.md`
- Test plan: `test-plan-ai-import-reports.md`
- Architecture: `planning-artifacts/architecture.md`
- PRD: `planning-artifacts/prd.md` (FR28-32 for daily report context)
- Existing daily-report service: `src/features/daily-report/services/daily-report.service.ts`
- Existing admin route: `src/routes/_app/team/route.tsx` (layout pattern)
- Existing sidebar: `src/components/layout/app-sidebar.tsx`
- Existing permissions: `src/hooks/use-permissions.ts`, `src/lib/permissions.ts`

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (Anthropic) — 2026-03-30

### Debug Log References
- R5 N/A filter fix: PostgreSQL NULL in JSON → use COALESCE before TRIM/empty check
- S1/S2 auth: SET LOCAL request.jwt.claims for JWT simulation in postgres role tests
- S2 tenant isolation: explicit `current_tenant_id() IS DISTINCT FROM p_tenant_id` check needed (is_tenant_manager() only checks role, not tenant)
- auth.users FK: public.users.id references auth.users.id → must insert auth.users first in tests
- handle_new_tenant trigger: disable before INSERT INTO tenants in tests (uses auth.uid())
- JSON string syntax in DO $$: multiline JSON causes 0x0a error → use jsonb_build_array/jsonb_build_object

### Completion Notes List
- Edge function switched from Anthropic to OpenAI GPT-4o per user request (AC2)
- GPT-4o: messages array format {role:'system'} + {role:'user'}
- OpenAI endpoint: https://api.openai.com/v1/chat/completions
- User mapping: Levenshtein distance + VN diacritics strip + partial match → confidence score
- localStorage key: `import_mapping_{tenantId}`, LRU cache max 50 entries
- Upsert: skip → skip if (date, user_id) exists; overwrite → DELETE + INSERT
- N/A/empty tasks filtered: TRIM(COALESCE(desc, '')) NOT IN ('N/A','n/a','N/a','')
- RPC auth: checks (1) tenant_id JWT match p_tenant_id, (2) is_tenant_manager() = true
- Audit log: action='ai_import' in member_audit_logs, details include imported/skipped/overwritten/mode/errors

### File List

**New files:**
- `supabase/functions/ai-parse/index.ts` — OpenAI GPT-4o edge function
- `src/features/ai-import/types/ai-parse.types.ts` — Zod schemas + TypeScript types
- `src/features/ai-import/lib/user-mapping.ts` — VN normalization, fuzzy matching, LRU cache, localStorage
- `src/features/ai-import/hooks/use-ai-parse.ts` — TanStack Query mutation for AI parsing
- `src/features/ai-import/hooks/use-import-reports.ts` — TanStack Query mutation for RPC import
- `src/features/ai-import/services/ai-import.service.ts` — Service layer: parseReports, importReports, getTenantUsers, buildImportRows
- `src/features/ai-import/components/ImportPage.tsx` — Main import page with 3-phase flow (input→preview→result)
- `src/features/ai-import/components/ImportPreviewTable.tsx` — Preview table with yellow unmapped badge
- `src/features/ai-import/components/UserMappingModal.tsx` — Mapping dialog with user selector
- `src/features/ai-import/components/ImportResultSummary.tsx` — Result cards (imported/skipped/overwritten) + error list
- `src/features/ai-import/__tests__/ai-parse.types.test.ts` — Zod schema unit tests (15 tests)
- `src/features/ai-import/__tests__/user-mapping.test.ts` — User mapping unit tests (16 tests)
- `src/routes/_app/admin/route.tsx` — AdminLayout route
- `src/routes/_app/admin/import.tsx` — Import page route with role guard
- `supabase/migrations/20260330_import_slack_rpc.sql` — import_slack_reports RPC function
- `supabase/tests/test_ai_import_rpc.sql` — RPC integration + RLS security tests (R1–R10, S1–S2)

**Modified files:**
- `src/lib/routes.ts` — Added `admin.import: '/admin/import'`
- `src/components/layout/data/sidebar-data.ts` — Added Import nav item with Upload icon, roles ['owner','manager']
