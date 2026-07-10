# Phase 1 — Tách Period model dùng chung + usage data layer

## Context

- Period model hiện ở `src/features/analytics/utils/analytics.utils.ts` (đã commit, có test `__tests__/analytics-period.test.ts`).
- `PeriodNavigator` ở `src/features/analytics/components/PeriodNavigator.tsx`.
- Usage query hiện inline trong `src/routes/_app/usage.tsx` (fetchTeamStatus/fetchLatestSnapshots/fetchSnapshotHistory/latestPerSession).

## Requirements

### 1. Tách Period model sang dùng chung (DRY, tránh coupling usage→analytics)

- Tạo `src/lib/period.ts` chứa phần generic: `Granularity`, `Period`, `getPeriodRange`, `shiftPeriod`, `isCurrentOrFuturePeriod`, `formatPeriodLabel`, `getWindowRange`, `getGranularityUnit`, `WORKDAYS_PER_WEEK`, `getPeriodCommittedMultiplier` (committed multiplier vẫn generic đủ, giữ chung).
- `analytics.utils.ts` re-export các symbol trên từ `@/lib/period` (giữ import cũ của analytics không đổi) HOẶC cập nhật import ở analytics sang `@/lib/period`. Chọn cách ít vỡ nhất: **re-export** để không phải sửa MemberTrendChart/analytics.tsx/tests.
- Di chuyển test period sang `src/lib/__tests__/period.test.ts` (hoặc giữ nguyên vị trí, import path đổi). Chạy vitest full sau khi tách.

### 2. Chuyển PeriodNavigator thành dùng chung + giới hạn granularity

- Chuyển `PeriodNavigator.tsx` sang `src/components/period-navigator.tsx` (shared). Cập nhật import ở `analytics.tsx`.
- Thêm prop `granularities?: Granularity[]` (default cả 4). `/usage` truyền `['day','week','month']`.

### 3. Usage data layer (feature module mới)

Tạo `src/features/usage/`:
- `services/usage.service.ts`: chuyển các fetch từ route vào; thêm:
  - `fetchSnapshotsForPeriod(tenantId, start, end)` — snapshots trong [start,end] (created_at), order desc, limit hợp lý.
  - `fetchSessionsForPeriod(tenantId, start, end)` — claude_sessions có hoạt động trong kỳ (last_seen_at/started_at giao kỳ) HOẶC suy từ snapshots (distinct session_id). Chọn suy từ snapshots để đủ dữ liệu chỉ số.
- `utils/usage-aggregate.ts` (pure, testable):
  - `latestPerSession(snapshots)` (chuyển từ route).
  - `groupByUser(rows, latestBySession)` → 1 dòng/user: email/name, sessionIds[], sessionCount, lastActivity (max last_seen_at/created_at), latest snapshot toàn user (theo created_at), status tổng hợp.
  - `buildUsageChartData(snapshots, granularity)` — bucket theo phút (day) hoặc theo ngày (week/month), team total context_tokens (sum latest-per-session mỗi bucket).

## Files

- Create: `src/lib/period.ts`, `src/components/period-navigator.tsx`, `src/features/usage/services/usage.service.ts`, `src/features/usage/utils/usage-aggregate.ts`
- Modify: `src/features/analytics/utils/analytics.utils.ts` (re-export), `src/routes/_app/analytics.tsx` (import PeriodNavigator từ vị trí mới), delete cũ `PeriodNavigator.tsx` (đã dời)
- Types: mở rộng `src/lib/usage-types.ts` nếu cần `UserUsageRow`.

## Validation

- `vitest run` full xanh (analytics tests không đổi hành vi).
- tsc/eslint sạch.

## Rủi ro / rollback

- Đổi vị trí PeriodNavigator/Period đụng analytics → test bao phủ; nếu vỡ, giữ re-export shim ở analytics.utils.ts.
- Giữ commit Phase 1 tách biệt để revert dễ.
