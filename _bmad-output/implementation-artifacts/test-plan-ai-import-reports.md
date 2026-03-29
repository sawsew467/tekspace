# Test Plan: AI Import Daily Reports

**Feature:** `ai-import-reports`
**Spec:** `tech-spec-ai-import-reports.md`
**Status:** Created before implementation
**Stack:** Vitest (unit) + Supabase test suite + Playwright (E2E)

---

## 1. Unit Tests (Vitest)

### 1.1 User Mapping (`src/features/ai-import/lib/user-mapping.ts`)

| # | Test case | Expected |
|---|-----------|----------|
| M1 | `normalizeVietnamese('Nguyễn Văn Minh')` | `'nguyen van minh'` |
| M2 | `normalizeForMatch('  MINH  @Tekmium  ')` | `'minhtekmium'` |
| M3 | `findBestMatch('minh.nguyen')` → existing user `'Minh Nguyen'` | returns user_id, `mapped: true` |
| M4 | `findBestMatch('unknown.person')` → no match | returns `null`, `mapped: false` |
| M5 | `findBestMatch('John')` → exact match `'John'` | returns user_id |
| M6 | Multiple candidates → picks highest similarity | returns correct user_id |
| M7 | VN diacritics normalization → ASCII match | matches after normalization |
| M8 | Case-insensitive match | matches regardless of case |

### 1.2 localStorage Persistence

| # | Test case | Expected |
|---|-----------|----------|
| L1 | `saveMapping(tenantId, {...})` → reload page → `loadMapping(tenantId)` | returns saved mapping |
| L2 | Save > 50 mappings → verify LRU eviction | oldest entry removed |
| L3 | `loadMapping('nonexistent-tenant')` | returns `{}` |
| L4 | Corrupt JSON in localStorage → `loadMapping` | returns `{}`, does not throw |
| L5 | Clear mapping → verify empty | returns `{}` |

### 1.3 Zod Schema Validation (`src/features/ai-import/types/ai-parse.types.ts`)

| # | Test case | Expected |
|---|-----------|----------|
| Z1 | Valid `ParsedSlackReport` → `parsedSlackReportSchema.parse()` | passes |
| Z2 | Missing required `author` field | throws `ZodError` |
| Z3 | Invalid `report_date` format (not ISO) | throws `ZodError` |
| Z4 | `hours` = `3.75` (not 0.5 increment) | passes (validation allows any decimal, rounding is display concern) |
| Z5 | `hours` = negative number | throws `ZodError` |
| Z6 | `output_type` = `'pr'` with valid URL | passes |
| Z7 | `output_type` = `'pr'` with invalid URL | throws `ZodError` |
| Z8 | Empty `tasks_completed` array | passes |
| Z9 | `in_progress` tasks missing `output_type` | passes (output fields are optional) |
| Z10 | Malformed JSON input | throws `ZodError` |

### 1.4 Edge Function Error Handling (mock OpenAI API)

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| E1 | API returns valid JSON | mock success response | returns `ParsedSlackReport[]` |
| E2 | API returns non-JSON | mock 500 error page | returns `{ error: string }` HTTP 500 |
| E3 | API timeout | mock timeout | returns `{ error: 'timeout' }` HTTP 500 |
| E4 | Empty input text | `text = ''` | returns `[]` |
| E5 | Non-daily-report garbage text | random gibberish | returns `[]` with warning |
| E6 | Partial parse (some messages valid) | mixed valid/garbage | returns valid entries, frontend warning shown |

---

## 2. Integration Tests (Supabase)

### 2.1 PostgreSQL RPC — `import_slack_reports`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| R1 | `skip` mode — no existing report | insert new report | `imported: 1, skipped: 0, errors: []` |
| R2 | `skip` mode — report exists | duplicate date+user | `imported: 0, skipped: 1, errors: []` |
| R3 | `overwrite` mode — report exists | same date+user | existing row updated, `imported: 1` |
| R4 | `overwrite` mode — no existing | insert new | `imported: 1, skipped: 0` |
| R5 | Mixed batch: 1 new, 2 duplicates, 1 invalid user | | correct counts per category |
| R6 | `hours_logged` = sum of all task hours | tasks with 1h + 2h + 0.5h | `hours_logged = 3.5` |
| R7 | Empty `tasks_completed` array | no tasks | report created with `hours_logged = 0` |
| R8 | `N/A` section → no task row created | | no orphan task rows |
| R9 | Batch > 50 rows | large payload | processes all rows |
| R10 | Audit log written after import | | `audit_logs` row created with correct fields |

### 2.2 RLS Security — `import_slack_reports`

> **Method:** Inline test (per CLAUDE.md) using `supabase/tests/*.sql`

| # | Test case | Role | JWT Claims | Expected |
|---|-----------|------|-----------|----------|
| S1 | Call RPC | `owner` | valid `active_tenant_id` + `sub` | ✅ Pass |
| S2 | Call RPC | `manager` | valid `active_tenant_id` + `sub` | ✅ Pass |
| S3 | Call RPC | `member` | valid `active_tenant_id` + `sub` | ❌ `Forbidden: only owner/manager` |
| S4 | Call RPC | `viewer` | valid `active_tenant_id` + `sub` | ❌ `Forbidden` |
| S5 | Call RPC | `owner` | **wrong** `active_tenant_id` | ❌ `Forbidden` (tenant isolation) |
| S6 | Upsert to `daily_reports` after auth | `owner` | valid JWT | Row inserted with correct `tenant_id` |
| S7 | Upsert to `report_tasks` | `owner` | valid JWT | Row inserted, `daily_report_id` FK correct |
| S8 | SECURITY DEFINER bypass RLS check | `supabase_admin` | — | ✅ Pass (admin can call directly) |

### 2.3 Multi-format Parsing (sample files)

| # | Source | File | Expected |
|---|--------|------|----------|
| F1 | Slack export | `slack.txt` | parse ≥ expected count of reports |
| F2 | Discord export | (need sample) | parse ≥ expected count |
| F3 | MS Teams export | (need sample) | parse ≥ expected count |

---

## 3. E2E Tests (Playwright)

> Prerequisites: logged in as **owner** or **manager** in a tenant with ≥ 2 members.

### 3.1 Happy Path

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E2E1 | Full import flow | 1. Paste Slack text → 2. Click "Parse with AI" → 3. Review preview → 4. Map unmapped author → 5. Click Import → 6. See summary | Imported count > 0, no errors |
| E2E2 | Auto-mapping | Paste text where all authors match | All rows green, Import button enabled |
| E2E3 | Mapping persists | Map → reload page → paste new text | Mapping auto-applied |
| E2E4 | Overwrite mode | Import → change source → Import with Overwrite | data updated |

### 3.2 UI & UX

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E2E5 | Unmapped → yellow badge | Paste text with unknown author | Yellow badge shown |
| E2E6 | Unmapped → click badge → dropdown | Click yellow badge | UserMappingModal opens |
| E2E7 | Import disabled when unmapped | Has unmapped authors | Import button disabled |
| E2E8 | "Import only mapped" | Check → Import | Unmapped skipped, warning shown |
| E2E9 | All unmapped → disabled | No author can be mapped | Button disabled + message shown |
| E2E10 | Parse error → retry | API returns error | Error banner + Retry button works |
| E2E11 | Sidebar link visibility | Login as `member` | No "Import" link in sidebar |
| E2E12 | Sidebar link visibility | Login as `manager` | "Import" link visible |

### 3.3 Role & Route Guards

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E2E13 | Direct URL `/admin/import` as `member` | Navigate directly | Redirect to `/` or 403 |
| E2E14 | Direct URL `/admin/import` as `owner` | Navigate directly | Page loads |
| E2E15 | `viewer` role → sidebar | Login as `viewer` | No "Import" link |

---

## 4. Performance & Edge Cases

| # | Test case | Expected |
|---|-----------|----------|
| P1 | 300 messages (~10K tokens) → parse | Completes < 30s |
| P2 | 500 messages → parse | Edge function handles gracefully |
| P3 | Very long single line (> 4096 tokens) | API returns error gracefully |
| P4 | Concurrent imports by 2 users | No race conditions, correct isolation |
| P5 | Import same batch twice (skip mode) | All skipped on second run |
| P6 | LocalStorage quota exceeded | Graceful fallback, mapping not persisted |

---

## 5. Test Execution Order

```
Before implementation:
  1. Unit tests (M1–M8, L1–L5, Z1–Z10)        → implemented alongside feature code
  2. RPC unit + integration (R1–R10)           → after migration created
  3. RLS tests (S1–S8)                        → after migration + before story done

After implementation:
  4. Edge function tests (E1–E6)               → after edge function deployed
  5. E2E tests (E2E1–E2E15)                    → after all components wired
  6. Performance tests (P1–P6)                 → before story marked done
  7. Formal suite: npx supabase test db        → must PASS before story done
```

---

## 6. Test Files Location

```
src/features/ai-import/
  lib/
    user-mapping.test.ts         # M1–M8, L1–L5
  types/
    ai-parse.types.test.ts       # Z1–Z10

supabase/
  functions/ai-parse/
    index.test.ts                # E1–E6 (mock fetch)
  migrations/
    ...import_slack_rpc.sql      # S1–S8 via inline auth test
  tests/
    import_slack_reports_test.sql # R1–R10

e2e/
  ai-import.spec.ts              # E2E1–E2E15, P1–P6
```
