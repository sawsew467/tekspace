# Implementation Plan

## Tasks

**T1 — Supabase Edge Function (LLM Parser)**

`supabase/functions/ai-parse/index.ts`
- Nhận raw chat export text
- Gọi OpenAI API (OPENAI_API_KEY từ secrets)
- Parse response → validate Zod schema
- Return `ParsedSlackReport[]`
- Error: return `{ error: string }` với HTTP 500

**ENV required:**
```
OPENAI_API_KEY=sk-...  # set in Supabase dashboard
```

**API call pattern (Deno) — system prompt phải tách riêng:**
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: `[full system prompt from above]`
      },
      {
        role: 'user',
        content: `Parse this text as daily reports:\n\n${text}`
      }
    ]
  })
})
```

⚠️ **CRITICAL FIX:** System prompt phải nằm trong `messages[0]` với `role: 'system'`, không truyền trong user content.

**T2 — Frontend Types + User Mapping**

`src/features/ai-import/types/ai-parse.types.ts`
- Zod schemas: `parsedSlackReportSchema`, `parsedTaskSchema`
- TypeScript interfaces

`src/features/ai-import/lib/user-mapping.ts`
- `normalizeVietnamese(str)` — VN diacritics → ASCII
- `normalizeForMatch(str)` — lowercase, remove spaces
- `findBestMatch(authorName, users)` → user_id | null
- `loadMapping(tenantId)` → Record<string, string>
- `saveMapping(tenantId, Record<string, string>)` → void

**T3 — TanStack Query Hooks**

`src/features/ai-import/hooks/use-ai-parse.ts`
- `useAiParse()` → `useMutation`
- Input: raw chat export text
- Calls Edge Function `/functions/v1/ai-parse`
- Returns: `{ reports: ParsedSlackReport[], error: string | null }`

`src/features/ai-import/hooks/use-import-reports.ts`
- `useImportReports()` → `useMutation`
- Input: `{ reports: ImportableReport[], mode: 'skip' | 'overwrite' }`
- Calls RPC `import_slack_reports`
- Returns: `{ imported, skipped, errors }`

**T4 — Service Layer**

`src/features/ai-import/services/ai-import.service.ts`
- `parseReports(text: string)` — gọi edge function
- `importReports(reports: ImportableReport[], mode, tenantId)` — gọi RPC

**T5 — UI Components**

`src/features/ai-import/components/ImportPage.tsx`
- Textarea: paste chat export text
- Button: "Parse with AI 🤖" (primary)
- Skeleton: loading state khi parse
- Error banner nếu parse fail
- Import mode toggle: Skip | Overwrite

`src/features/ai-import/components/ImportPreviewTable.tsx`
- Table columns: Date | Member | Tasks ✅ | In Progress | Plan | Blockers | Status
- Expand row: show task details inline
- Badge: green=matched, yellow=unmapped, gray=empty
- "Expand" toggle per row

`src/features/ai-import/components/UserMappingModal.tsx`
- Table: Author (from chat) → TekSpace User (dropdown)
- Unmapped rows highlighted yellow
- "Import only mapped" checkbox
- "X reports will be skipped" warning

`src/features/ai-import/components/ImportResultSummary.tsx`
- Cards: Imported (green), Skipped (yellow), Errors (red)
- Error details: expandable list
- "Import again" button

**T6 — Routing + Layout**

`src/routes/_app/admin/route.tsx`
```tsx
function AdminLayout() {
  return <PageContainer variant='wide'><Outlet /></PageContainer>
}
```

`src/routes/_app/admin/import.tsx`
- Route definition + lazy load ImportSlackPage

**T7 — Sidebar Navigation**

`src/components/layout/app-sidebar.tsx`
- Thêm nav item: `icon={Upload} label="Import" href="/admin/import"`
- Chỉ hiện nếu `role === 'owner' || role === 'manager'`

**T8 — Migration**

`supabase/migrations/YYYYMMDD_import_slack_rpc.sql`
- Tạo function `import_slack_reports(...)`
- Batching logic 50 rows/batch
- Authorization check
- Audit log insert
