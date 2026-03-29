# Technical Decisions

## LLM Parser (Primary)

**Edge Function:** `supabase/functions/ai-parse/index.ts`

**API:** OpenAI GPT-4o

**Prompt strategy:** Zero-shot — không cần fine-tune. GPT-4o hiểu Slack message format tự nhiên.

**System prompt (core) — TRUYỀN TRONG messages[] ARRAY, KHÔNG trong user content:**
```
Bạn là parser chuyên tách thông tin daily report từ text export của các nền tảng chat (Slack, Discord, MS Teams, v.v.).

Input: raw chat export text — có thể là bất kỳ format nào.
Output: JSON array — mỗi item = 1 daily report của 1 member.

Với MỖI message tìm được, trả về:
- author: tên member (string, không đoán)
- report_date: ngày report (ISO yyyy-MM-dd)
- submitted_at: timestamp của message (ISO) hoặc null
- tasks_completed: array of tasks
  - project_tag: tên project (VD: Giftlinke, SafeEdu) hoặc null
  - description: mô tả task
  - hours: số giờ (decimal, 0.5 increments) hoặc null
  - output_type: 'pr' | 'figma' | 'document' | 'other' | null
  - output_link: URL nếu có, null nếu không
- in_progress: array of tasks (cùng structure, không có output_type/output_link)
- plan_for_tomorrow: text hoặc null
- blockers: text hoặc null

Rules:
- Nếu không tìm thấy author → bỏ qua message đó
- Nếu không tìm thấy date → bỏ qua message đó
- N/A, None, "" lines → bỏ qua
- Edited messages: dùng version mới nhất
- Tasks: extract project tag từ [ProjectName] hoặc similar syntax
- Hours: parse "3h", "30p", "3.5h", "3h10", "30'" → decimal
- PR: nếu có link github.com → output_type='pr', output_link=URL
- Nếu section trống → return empty array hoặc null
- Nếu input không phải daily report format → vẫn parse, trả về empty array

CRITICAL: Your response must be ONLY valid JSON. No markdown, no code fences, no explanation.
Return ONLY the JSON array. Nothing else.
```

**Output schema validation:** Zod parse ở frontend + validation ở Edge Function trước khi return.

**Error handling:**
- LLM fail → return error message + retry button
- Partial parse (some messages skipped) → vẫn return, frontend hiện warning

## User Mapping (INLINE)

1. LLM trả về `author` (raw name từ Slack)
2. Frontend normalize → so sánh với `users.full_name` trong tenant
3. Không match → hiện yellow badge → click → dropdown chọn TekSpace user
4. Mapping persist trong `localStorage` key: `import_mapping_{tenant_id}`

**LRU cache limit:** Giữ tối đa 50 mappings — tự động cleanup old entries khi > 50.

**VN normalization (cho matching):**
```typescript
const VN_MAP = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'â': 'a', 'ă': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ơ': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
  'đ': 'd',
}
// normalize: remove spaces, lowercase, translate VN chars
// match: exact match sau normalize
```

## Import: PostgreSQL RPC

**Strategy:** Skip (default) / Overwrite toggle

**RPC function — ⚠️ Phải có authorization check:**
```sql
-- p_reports: jsonb array of parsed reports
-- p_mode: 'skip' | 'overwrite'
-- Authorization: SECURITY DEFINER bypasses RLS — DO THÊM role check bên trong
CREATE OR REPLACE FUNCTION import_slack_reports(
  p_reports    jsonb,
  p_mode       text DEFAULT 'skip',
  p_tenant_id  uuid
)
RETURNS jsonb  -- {imported: N, skipped: M, errors: [...]}
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
-- ⚠️ CRITICAL: Authorization check — SECURITY DEFINER bypasses RLS
-- nhưng KHÔNG bypass application-level auth
IF NOT EXISTS (
  SELECT 1 FROM tenant_members
  WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'manager')
) THEN
  RAISE EXCEPTION 'Forbidden: only owner/manager can import';
END IF;
-- ... rest of function
$$;
```

**Batching + Error tracking:** Dùng temp table để track imported/skipped/errors — tránh `ON CONFLICT DO NOTHING` không đếm được rows:
```sql
CREATE TEMP TABLE import_errors ON COMMIT DROP AS
SELECT null::date as report_date, null::uuid as user_id, null::text as error WITH NO DATA;

CREATE TEMP TABLE import_results(imported int, skipped int);
```

**Audit log:** Luôn ghi sau khi hoàn tất, kể cả partial failure.

## Types

```typescript
// LLM Output (validated by Zod)
interface ParsedSlackReport {
  author: string
  report_date: string      // ISO yyyy-MM-dd
  submitted_at: string      // ISO timestamp
  tasks_completed: ParsedTask[]
  in_progress: ParsedTask[]
  plan_for_tomorrow: string | null
  blockers: string | null
}

interface ParsedTask {
  project_tag: string | null
  description: string
  hours: number | null     // decimal, 0.5 increments
  output_type: 'pr' | 'figma' | 'document' | 'other' | null
  output_link: string | null
}

// Mapped for import
interface ImportableReport extends ParsedSlackReport {
  user_id: string         // TekSpace user ID (mapped)
  mapped: boolean
  hours_logged: number     // sum of all task hours
}
```
