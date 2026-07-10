# Phase 2 — Bảng gộp theo user + user detail sheet

## Context

- Bảng hiện: `useTeamColumns` (cột user_id/model/project/branch/ctx/quota/lines/status), 1 dòng/session; `TeamTableRow` = session + latest snapshot.
- Sheet hiện: `SessionHistorySheet` nhận `TeamTableRow`, fetch `fetchSnapshotHistory(session_id)`.

## Requirements

### 1. Bảng ngoài gộp theo user

- Dữ liệu = `groupByUser(...)` (Phase 1) → `UserUsageRow`:
  - `user_id`, `tenant_id`, `email`, `name`
  - `status` (tổng hợp: active nếu có session active; else idle; else offline)
  - `sessionCount`, `sessionIds[]`
  - `lastActivity`
  - `latest` (snapshot mới nhất toàn user) → ctx%/quota/lines
- Cột mới: Dev · Model (của session mới nhất) · #Sessions · Ctx% · Quota 5h/7d · Lines · Hoạt động gần nhất · Status.
- Bỏ Project/Branch khỏi bảng ngoài (thuộc về session-level → đưa vào detail).

### 2. User detail sheet (thay/đổi SessionHistorySheet)

- Click user → sheet hiển thị:
  - Header: tên/email user.
  - Danh sách **session** của user trong kỳ: project_name · branch · model · started/last_seen · latest ctx%.
  - Click 1 session → mở lịch sử snapshot của session đó (giữ `fetchSnapshotHistory` + bảng snapshot hiện có). Có thể là 2 cấp trong cùng sheet (list → chọn session → history) hoặc accordion.
- Giữ `fetchSnapshotHistory` nguyên vẹn.

## Files

- Modify: `src/routes/_app/usage.tsx` (columns, table data, sheet). Cân nhắc tách `UserUsageTable.tsx` + `UserDetailSheet.tsx` vào `src/features/usage/components/` cho gọn route.
- Use: `src/features/usage/utils/usage-aggregate.ts` (groupByUser), `usage.service.ts`.
- Types: `UserUsageRow` trong `usage-types.ts`.

## Validation

- 1 user nhiều session → đúng 1 dòng; sessionCount đúng.
- Status tổng hợp đúng (active nếu ≥1 session active).
- Click user → thấy đúng các session của user; click session → snapshot history đúng.

## Rủi ro / rollback

- Đổi shape row (session→user) đụng `useTeamColumns`, `ClickableDataTable` (generic theo `TeamTableRow`) → cập nhật generic sang `UserUsageRow`.
- Realtime invalidate giữ nguyên (invalidate query keys, data tự gộp lại).
