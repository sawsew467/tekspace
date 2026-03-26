# Sprint Change Proposal — TekSpace
**Ngày:** 2026-03-26
**Người raise:** Thắng
**Scope:** Post-Retro Epic 5+6+8 — Product Quality & Feature Completion
**Change scope classification:** Minor (tạo epic mới với 5 stories rõ ràng, không thay đổi architecture cốt lõi)

---

## Section 1: Issue Summary

Sau khi hoàn thành retrospective combined Epic 5+6+8 (2026-03-26), review thực tế của sản phẩm và team đã xác định:

1. **1 bug critical** chặn user ngay sau login (redirect stringify bug từ story 8-18)
2. **2 feature gaps quan trọng** so với cách team thực tế làm việc:
   - Daily Report form không match format 4 sections của team Tekmium
   - Incident flow thiếu final resolution states (dismiss/uphold) — không rõ incident có tính vi phạm không
3. **2 mobile UI bugs** ảnh hưởng usability trên điện thoại
4. **1 inconsistency nhỏ** giữa sidebar label và page title

**Scope UI/UX overhaul** (sign-in page redesign, analytics visual, dashboard cards...) **được defer** — sẽ được plan riêng sau khi Sally hoàn tất UI/UX audit session.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Ảnh hưởng |
|------|-----------|
| Epic 4 (Daily Report) | Schema mở rộng: project_tag + in_progress tasks + plan_for_tomorrow + blockers |
| Epic 7 (Incident Management) | Schema mới: `incident_resolutions` table để complete lifecycle |
| Epic 8 (UX Polish) | Bug 8-18 sinh ra B1 — cần fix trong context mới |
| **Epic 9 mới** | Tạo mới — Product Quality & Feature Completion |

### Story Impact

**5 stories cần tạo mới trong Epic 9:**

| Story | Tên | Type | Priority | Wave |
|-------|-----|------|----------|------|
| 9-1 | login-redirect-fix | Bug | 🔴 HIGH | 1 |
| 9-2 | daily-report-four-sections | Feature | 🔴 HIGH | 2 |
| 9-3 | incident-lifecycle-dismiss-uphold | Feature | 🔴 HIGH | 2 |
| 9-4 | mobile-ui-fixes | Bug | 🟡 MEDIUM | 1 |
| 9-5 | page-title-team-schedule | Bug | 🟢 LOW | 1 |

### Artifact Conflicts

| Artifact | Conflict | Cần update |
|----------|----------|------------|
| `epics.md` | Chưa có Epic 9 | Append Epic 9 + 5 stories |
| `sprint-status.yaml` | Chưa có epic-9 entries | Thêm epic-9 + 5 story keys |
| DB schema | `report_tasks`, `daily_reports` thiếu columns | Migration mới trong story 9-2 |
| DB schema | `incident_resolutions` chưa tồn tại | Migration mới trong story 9-3 |

### Technical Impact

- **Migration 9-2:** `report_tasks.project_tag`, `report_tasks.task_type`, `daily_reports.plan_for_tomorrow`, `daily_reports.blockers` — tất cả nullable, backward compatible
- **Migration 9-3:** Bảng mới `incident_resolutions` với UNIQUE constraint trên `incident_id` — append-only, không vi phạm immutable audit trail
- **No architecture changes:** Không thêm service mới, không thay đổi Edge Functions, không thay đổi Auth flow

---

## Section 3: Recommended Approach

**Lựa chọn: Direct Adjustment — Tạo Epic 9: Product Quality & Feature Completion**

**Rationale:**
- B1 là blocking UX issue cần fix ngay
- P1 và P2 là feature gaps cụ thể, scope rõ ràng, không cần thêm planning
- DB changes nhỏ, backward compatible, không cần migration phức tạp
- 5 stories có thể chạy trong 2 waves song song — effort tổng ~2-3 ngày

**Parallel execution plan:**
```
Wave 1 (song song, không conflict):
  Agent A: 9-1 (login redirect fix)
  Agent B: 9-4 (mobile UI fixes)
  Agent C: 9-5 (page title fix)

Wave 2 (sau Wave 1, song song nhau):
  Agent D: 9-2 (daily report form)
  Agent E: 9-3 (incident lifecycle)
```

**Risk assessment:** Low — không có breaking changes, không thay đổi core architecture.

---

## Section 4: Detailed Change Proposals

### Story 9-1: Fix Login Redirect Bug

**Story:** 9-1-login-redirect-fix

As a user,
I want to be redirected correctly after login,
So that I land on the right page instead of a 404 error.

**Root cause:** Story 8-18 pass redirect param như object thay vì string → `toString()` trả về `[object Object]`.

**Acceptance Criteria:**

**Given** user chưa login và truy cập một protected route
**When** user hoàn tất đăng nhập
**Then** user được redirect đến đúng URL trước đó (không phải `/dashboard[object Object]`)

**Given** user login từ sign-in page trực tiếp (không có redirect param)
**When** login thành công
**Then** user được redirect đến `/dashboard` (default)

**Given** redirect-back param tồn tại trong URL
**When** param được parse và dùng
**Then** param luôn là string hợp lệ — không bao giờ stringify object thành `[object Object]`

**Files likely affected:** `src/routes/sign-in.tsx`, `src/routes/_app.tsx` / `beforeLoad` hook

---

### Story 9-2: Daily Report Form — 4 Sections

**Story:** 9-2-daily-report-four-sections

As a member,
I want to submit a daily report with 4 structured sections matching how my team actually works,
So that my report accurately captures completed work, ongoing tasks, tomorrow's plan, and blockers.

**Acceptance Criteria:**

**Given** member mở Daily Report form
**When** form render
**Then** form hiển thị 4 sections: Tasks Completed Today / In Progress / Plan for Tomorrow / Blockers

**Given** member thêm task vào Section 1 (Tasks Completed)
**When** member điền task
**Then** mỗi task có: [Project tag] + description + output_type + output_link + hours
**And** project_tag là free-text input, optional, hiển thị như badge prefix

**Given** member điền Section 2 (In Progress / Ongoing)
**When** member nhập
**Then** mỗi item có: description + project_tag (optional) + hours (bắt buộc để tính năng suất ngày) — không có output_link

**Given** member điền Section 3 (Plan for Tomorrow) và Section 4 (Blockers)
**When** member nhập
**Then** đây là text area tự do, optional

**Given** manager xem report
**When** manager click vào report
**Then** tất cả 4 sections đều hiển thị đầy đủ

**Given** member không điền Section 2, 3, 4
**When** member submit
**Then** report submit bình thường — Section 1 là required duy nhất

**DB Migration:**
```sql
ALTER TABLE report_tasks ADD COLUMN project_tag TEXT;
ALTER TABLE report_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'completed'
  CHECK (task_type IN ('completed', 'in_progress'));

ALTER TABLE daily_reports ADD COLUMN plan_for_tomorrow TEXT;
ALTER TABLE daily_reports ADD COLUMN blockers TEXT;
```

---

### Story 9-3: Incident Lifecycle — Dismiss/Uphold

**Story:** 9-3-incident-lifecycle-dismiss-uphold

As a Manager,
I want to formally resolve incidents as dismissed or upheld after reviewing any appeal,
So that there is a clear final outcome and member violation stats are accurate.

**Acceptance Criteria:**

**Given** Manager xem một incident chưa resolve
**When** Manager click "Resolve Incident"
**Then** Manager thấy 2 options: "Bỏ qua vi phạm" (Dismiss) / "Giữ nguyên vi phạm" (Uphold)
**And** resolution note là optional

**Given** Manager submit resolution
**When** submit thành công
**Then** `incident_resolutions` record được INSERT (không UPDATE incident gốc)
**And** incident hiển thị status: Dismissed hoặc Upheld với note và timestamp
**And** member nhận in-app notification về kết quả

**Given** Member xem incident đã resolve
**When** member xem detail
**Then** member thấy outcome + resolution note của Manager
**And** nếu Upheld → violation count tăng trong summary của member

**Given** Manager xem Team Incidents page
**When** filter theo status
**Then** filter: All / Pending / Dismissed / Upheld

**Given** incident đã resolve
**When** Manager cố resolve lại
**Then** resolve button bị disabled/ẩn

**DB Migration:**
```sql
CREATE TABLE incident_resolutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  outcome     TEXT NOT NULL CHECK (outcome IN ('dismissed', 'upheld')),
  note        TEXT,
  resolved_by UUID NOT NULL REFERENCES users(id),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
);
ALTER TABLE incident_resolutions ENABLE ROW LEVEL SECURITY;
```

---

### Story 9-4: Mobile UI Fixes (B3 + B4)

**Story:** 9-4-mobile-ui-fixes

As a member on mobile,
I want stat cards and schedule action buttons to be readable and usable,
So that I can use TekSpace effectively on my phone.

**Acceptance Criteria:**

**Given** member xem Dashboard trên mobile
**When** stat card "Tỷ lệ hoàn thành" render
**Then** text không overflow — value được format gọn trong card

**Given** member xem My Schedule trên mobile
**When** member muốn edit/delete một slot
**Then** icon buttons có đủ contrast (WCAG AA minimum, 4.5:1)

**Given** cùng components trên desktop
**When** desktop render
**Then** không có thay đổi visual — fix chỉ apply cho mobile breakpoint

---

### Story 9-5: Fix Page Title "Team Schedule"

**Story:** 9-5-page-title-team-schedule

As a user,
I want the page title to match the sidebar label,
So that browser tab and navigation are consistent.

**Acceptance Criteria:**

**Given** user đang ở trang Team Schedule (`/team-schedule`)
**When** trang load
**Then** browser tab title hiển thị "Team Schedule | TekSpace"
**And** không còn "Team Dashboard" ở bất kỳ đâu trên trang này

---

## Section 5: Implementation Handoff

**Change scope: Minor** — Development team implement trực tiếp.

**Execution order:**
1. Tạo story files (create-story workflow) cho từng story theo thứ tự ưu tiên
2. Wave 1: 9-1 + 9-4 + 9-5 song song
3. Wave 2: 9-2 + 9-3 song song (sau Wave 1)
4. Code review sau mỗi story trước khi mark done

**Success criteria:**
- B1: User login thành công → redirect đúng trang, không có 404
- P1: Member submit report với đủ 4 sections, manager thấy đầy đủ
- P2: Manager resolve incident → member thấy Dismissed/Upheld outcome
- B3/B4: Mobile usability không có overflow hay invisible buttons
- B2: Browser tab hiển thị "Team Schedule" đúng

**Deferred (separate context):**
- UI/UX overhaul (Sally's audit): sign-in page, analytics visual, dashboard cards, devtools badges
- AI features: 5 features pending scope decision

---

*Sprint Change Proposal generated: 2026-03-26*
*Approved by: Thắng*
*Next: create-story workflow để tạo story files cho Epic 9*
