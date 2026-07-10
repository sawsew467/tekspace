# Phase 3 — Filter kỳ Ngày/Tuần/Tháng cho table + chart + stats

## Context

- Sau Phase 1–2: có PeriodNavigator shared (giới hạn day/week/month), usage.service period queries, groupByUser, buildUsageChartData.
- Route hiện fetch live: `fetchTeamStatus` + `fetchLatestSnapshots` (không theo kỳ).

## Requirements

1. State: `const [period, setPeriod] = useState<Period>({ granularity: 'day', anchor: today })`.
2. Range = `getPeriodRange(period)`. Gắn `PeriodNavigator granularities={['day','week','month']}` ở page header.
3. Query theo kỳ:
   - `fetchSnapshotsForPeriod(tenantId, start, end)` thay `fetchLatestSnapshots` khi kỳ ≠ hôm nay.
   - Bảng: `groupByUser` từ snapshots trong kỳ + (nếu kỳ hiện tại) status từ `usage_team_status`.
   - Kỳ hiện tại (chứa hôm nay): giữ hành vi live cũ + realtime; kỳ quá khứ: chỉ số từ snapshots, status = "hoạt động gần nhất" (Quyết định #2 trong plan.md).
4. Chart: `buildUsageChartData(snapshots, granularity)` — day→phút, week/month→ngày; team total. Đổi tiêu đề chart theo kỳ.
5. Stat cards: "Total context tokens" (sum latest-per-session trong kỳ) + "Active devs" (kỳ hiện tại = đang active; kỳ quá khứ = số user có hoạt động trong kỳ, đổi label).
6. Realtime: chỉ invalidate/áp khi `isCurrentOrFuturePeriod(period)`; xem kỳ cũ không bị nhảy dữ liệu.

## Files

- Modify: `src/routes/_app/usage.tsx` (period state, queries, chart/stat wiring, PeriodNavigator).

## Validation

- Đổi Day/Week/Month + ◀▶ → table/chart/stats cập nhật đúng kỳ; ▶ disable ở kỳ hiện tại.
- Kỳ hôm nay: hành vi ≈ hiện tại (live + realtime).
- Kỳ cũ: dữ liệu tĩnh đúng range, không bị realtime ghi đè.

## Rủi ro / rollback

- Query tháng nhiều dòng → limit + index; nếu chậm ghi chú RPC aggregate (ngoài scope).
- Nhãn/ý nghĩa status kỳ quá khứ dễ gây nhầm → label rõ ("Hoạt động gần nhất" thay "Status").
