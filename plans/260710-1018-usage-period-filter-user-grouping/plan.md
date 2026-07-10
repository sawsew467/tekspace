# /usage — Filter Ngày/Tuần/Tháng + gộp bảng theo user

## Mục tiêu

Trang `/usage` (`src/routes/_app/usage.tsx`) giữ nguyên bố cục hiện tại (stat cards + area chart + bảng), thêm 2 thứ:

1. **Filter kỳ Ngày/Tuần/Tháng** (+ điều hướng lùi/tiến) để xem team xài Claude trong 1 ngày / 1 tuần / 1 tháng và xem lại kỳ cũ. Chart lịch sử = **tổng team**.
2. **Bảng ngoài gộp theo user** (`user_id` + `tenant_id`), không phải theo session. 1 user nhiều session = 1 dòng; các session chỉ hiện trong **detail** (sheet) → click session → lịch sử snapshot (như hiện tại).

Chỉ số hiển thị giữ nguyên (lines +/−, ctx%, quota, context tokens). Chỉ đọc DB — không migration. DB là Supabase cloud.

## Bối cảnh (scout)

- `usage.tsx` = 1 route 710 dòng, mọi thứ inline; chưa có feature module cho usage.
- Nguồn dữ liệu: `usage_team_status` (view, status live theo `last_seen_at`), `usage_snapshots` (lịch sử: created_at, context_tokens, lines_added/removed, five/seven_day_pct, per session/user/tenant), `claude_sessions`. Index sẵn `(tenant_id, created_at)`, `(user_id, created_at)`.
- Query qua `db = supabase as unknown as ...` (generated types chưa có bảng usage); types local ở `src/lib/usage-types.ts`.
- Hiện tại: bảng 1 dòng/session (`fetchTeamStatus`), enrich `latest` = snapshot mới nhất/session; sheet = `fetchSnapshotHistory(session_id)`.
- Period model (Granularity/Period + getPeriodRange/shiftPeriod/formatPeriodLabel/getWindowRange/isCurrentOrFuturePeriod/getGranularityUnit) + `PeriodNavigator` vừa build ở feature analytics (đã commit). **Tái dùng** — xem Phase 1.

## Phases

| # | Tên | Phụ thuộc | File |
|---|-----|-----------|------|
| 1 | Tách Period model dùng chung + usage data layer | — | `phase-01-shared-period-and-usage-data.md` |
| 2 | Bảng gộp theo user + user detail sheet | 1 | `phase-02-user-grouped-table.md` |
| 3 | Filter kỳ Ngày/Tuần/Tháng cho table + chart + stats | 1,2 | `phase-03-period-filter-wiring.md` |
| 4 | Tests + verify | 1,2,3 | `phase-04-tests-verify.md` |

## Acceptance Criteria

- AC1 — `/usage` có PeriodNavigator (Ngày/Tuần/Tháng, mặc định Ngày = hôm nay ≈ hành vi live cũ); ◀▶ xem kỳ cũ; ▶ disable ở kỳ hiện tại.
- AC2 — Bảng ngoài 1 dòng/user; cột: dev(email/name) · trạng thái · #session · hoạt động gần nhất · ctx%/quota/lines từ snapshot mới nhất của user trong kỳ.
- AC3 — Click user → sheet liệt kê các session của user trong kỳ → click session → lịch sử snapshot (giữ nguyên).
- AC4 — Chart + stat cards phản ánh kỳ đang chọn (team total); kỳ "hôm nay" giữ realtime như hiện tại.
- AC5 — Không phá analytics (Period model tách ra vẫn xanh test cũ); tsc/eslint/vitest xanh; không đổi public contract ngoài ý định.

## Quyết định mặc định (áp khi triển khai, chỉnh nếu cần)

1. **Granularity ở /usage**: chỉ Day/Week/Month (không Year) — theo yêu cầu. PeriodNavigator thêm prop `granularities?` để giới hạn.
2. **Trạng thái trong kỳ lịch sử**: kỳ chứa hôm nay → status live (active/idle/offline như view). Kỳ quá khứ → "đã hoạt động" (có snapshot trong kỳ) thay cho active/idle/offline; hoặc ẩn cột status ở kỳ quá khứ. Đề xuất: hiện "hoạt động gần nhất" + badge active chỉ khi kỳ = hôm nay.
3. **Chart bucketing theo kỳ**: Day → theo phút (như hiện tại); Week/Month → gom theo ngày. Team total context tokens (sum latest-per-session trong mỗi bucket thời gian).
4. **Realtime**: giữ subscribe; chỉ invalidate/áp cho kỳ hiện tại để tránh nhảy dữ liệu khi đang xem kỳ cũ.

## Rủi ro

- Tách Period model đụng file analytics vừa commit → có test bao phủ, chạy full vitest sau tách.
- `usage_snapshots` nhiều dòng theo kỳ tháng → dùng index (tenant_id, created_at), `.limit` hợp lý; cân nhắc RPC nếu chậm (ngoài scope, ghi chú).

## Trạng thái

- [x] Phase 1 — Tách `src/lib/period.ts` + `src/components/period-navigator.tsx` (prop `granularities`); usage service + `usage-aggregate` utils
- [x] Phase 2 — Bảng gộp theo user (`groupByUser`), `UserDetailSheet` (sessions → snapshot history)
- [x] Phase 3 — PeriodNavigator (day/week/month) wired vào table + chart + stats; realtime chỉ kỳ hiện tại
- [x] Phase 4 — 12 test usage-aggregate; regression analytics xanh

## Kết quả

- Verify: `tsc -b` sạch, eslint 0 error trên file đổi (1 warning pre-existing useReactTable), `vitest run` 393 passed (11 files).
- Analytics không đổi hành vi sau khi tách Period model (re-export).
- Code review (code-reviewer) → đã fix:
  - **C1 (critical)** timezone: `periodToTimestampBounds` giờ dùng nửa đêm LOCAL viewer → UTC instant (trước ghép chuỗi naive bị Postgres hiểu UTC, mất hoạt động 00:00–07:00 local).
  - **H1** chart double-count: `buildUsageChartData` lấy latest-per-session trong mỗi bucket thay vì cộng mọi snapshot.
  - **M3** `latestPerSession` so `created_at` (không phụ thuộc thứ tự input).
  - **L1** helper `userLabel` cho nhãn dev.

## Trade-off còn lại (đã chấp nhận, không blocker)

- **H3** User đã rời team: kỳ quá khứ hiển thị user_id rút gọn (identity map lấy từ team status live). Cần join bảng users nếu muốn giữ tên.
- **M1** `.limit(20000)` snapshots/kỳ tháng: tenant rất bận có thể bị cắt phần cũ nhất (không cảnh báo). Nếu cần chính xác → RPC aggregate server-side (ngoài scope).
- **M2** Session overlap kỳ nhưng snapshot nằm ngoài kỳ → cột ctx%/lines hiện "—".
