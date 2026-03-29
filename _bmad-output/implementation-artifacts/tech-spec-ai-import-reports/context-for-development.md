# Context for Development

## Architecture Overview

```
User paste chat export text (Slack / Discord / MS Teams...)
        ↓
useParse hook → Supabase Edge Function
        ↓
Edge Function calls OpenAI GPT-4o API
        ↓
Claude returns structured JSON (4 sections)
        ↓
Frontend: Preview Table + User Mapping
        ↓
useImportReports → PostgreSQL RPC (upsert)
        ↓
Result Summary
```

## Codebase Patterns

**Routing:** TanStack Router — `createFileRoute` với nested layout. Admin pages trong `_app/admin/`.

**TanStack Query hooks:** `useXxx.ts` trả về `{ data, error, isLoading }`. Mutations dùng `useMutation` với `onSuccess`.

**Supabase Edge Function (Deno):** Pattern từ existing edge functions trong project. Dùng `cors()` headers, validate input.

**Supabase service layer:** RPC cho import (upsert), Supabase client cho mapping.

**UI Components:** shadcn/ui — Button, Card, Table, Dialog, Select, Input, Label, Badge, Skeleton.

## Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/features/daily-report/services/daily-report.service.ts` | Pattern upsert reports |
| `src/routes/_app/team/route.tsx` | Layout pattern |
| `src/components/layout/app-sidebar.tsx` | Sidebar nav — thêm link `/admin/import` |
| `src/lib/query-keys.ts` | Thêm QUERY_KEYS cho import |
| `src/hooks/use-permissions.ts` | Kiểm tra role owner/manager |
| `supabase/functions/` | Existing edge functions để reference pattern |
