# Phase 4 — Tests + verify

## Requirements

1. Unit test `src/features/usage/utils/__tests__/usage-aggregate.test.ts`:
   - `latestPerSession`: chọn snapshot mới nhất/session (input desc-ordered).
   - `groupByUser`: 1 user nhiều session → 1 row, sessionCount đúng, latest = snapshot mới nhất toàn user, status tổng hợp (active nếu ≥1 active), lastActivity = max.
   - `buildUsageChartData`: day→bucket phút, week/month→bucket ngày; team total = sum latest-per-session/bucket; empty→[].
2. Nếu tách Period sang `src/lib/period.ts`: giữ/di chuyển test period, `vitest run` full xanh (analytics không đổi hành vi).
3. Regression: analytics tests vẫn pass sau khi tách Period model.

## Quality gates

1. `npx vitest run src/features/usage src/features/analytics src/lib` (narrow) xanh.
2. `npx tsc -b` sạch.
3. `npx eslint src/features/usage src/routes/_app/usage.tsx src/lib/period.ts src/components/period-navigator.tsx` sạch (lint repo-wide có nợ sẵn ở file khác — không tính).
4. `npx vitest run` full xanh.
5. (Tùy) chạy dev `pnpm dev`, mở /usage, đổi Day/Week/Month, click user→session→history — kiểm mắt.

## Validation

- Không hạ chuẩn test để pass. RLS: chỉ đọc, không đổi policy → không cần `supabase test db`, nhưng xác nhận query scope tenant đúng (eq tenant_id).

## Unresolved (chốt khi làm nếu phát sinh)

- Bucket chart tháng có thể nhiều điểm (≤31) — ổn.
- Nếu snapshots kỳ tháng vượt vài nghìn dòng gây chậm client-agg → cân nhắc RPC (ghi note, không làm trong scope này).
