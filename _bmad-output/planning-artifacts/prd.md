---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, readiness-gaps-fixed-2026-03-23]
inputDocuments:
  - product-brief-TekSpace-2026-03-23.md
workflowType: 'prd'
date: 2026-03-23
author: Thắng
classification:
  projectType: saas_b2b
  domain: hr_tech/workforce_management
  complexity: medium-high
  projectContext: greenfield
  notes:
    - Phase 1 behavior = single-tenant web_app
    - Schema = multi-tenant ready from day 1
    - No soft-deletes — status/flag only
    - Data export = Phase 2/3 (Future Considerations)
---

# Product Requirements Document - TekSpace

**Author:** Thắng
**Date:** 2026-03-23

## Executive Summary

TekSpace giúp manager thấy rõ remote team đang hoạt động
thế nào — và giúp mỗi thành viên tự cam kết với công việc
của chính mình.

Remote team với thành viên là sinh viên / part-time developer
đối mặt với bài toán cốt lõi: lịch làm việc không cố định,
không ai nhìn thấy ai đang available, và manager thiếu data
khách quan để đưa ra quyết định nhân sự. TekSpace giải quyết
bài toán này bằng schedule registration có cấu trúc, team
visibility dashboard, structured daily report, smart
notifications, và hours analytics — tất cả trong một hệ
thống, thay thế việc dùng chat và spreadsheet thủ công.

Core insight: hành động tự đăng ký lịch làm việc tạo ra cam
kết tâm lý — thành viên không chỉ đang cung cấp data cho
manager mà đang tự đặt ra kỳ vọng cho chính mình. Smart
notifications reinforce cam kết này ở đúng thời điểm: nhắc
trước deadline, alert khi lịch thay đổi, nhắc submit report.
Đây là cơ chế tạo ra accountability tự nguyện, không phải
áp đặt từ trên xuống.

Target users: remote team managers (team 5–8 người, scale
đến 30 người khi multi-tenant) cần visibility để giao việc
hiệu quả và đánh giá nhân sự bằng data; và student developers
/ part-time members — primary target market — cần công cụ
đơn giản để đăng ký lịch linh hoạt và tự theo dõi performance
của mình.

Giai đoạn 1: internal tool cho một team, standalone, không
có external integrations. Kiến trúc multi-tenant ready từ
ngày 1 để scale ra nhiều team mà không cần refactor. Roadmap
dài hạn: lightweight HR tool cho startup/agency nhỏ (5–30
người) — performance data, leave management, và data export
cho tính lương.

---

### What Makes This Special

**Schedule-as-commitment model:** Đăng ký lịch không chỉ là
calendar — đó là hành động cam kết. UI được thiết kế để
reinforce tâm lý này: template tuần trước tự load, thay đổi
phải có lý do, deadline lock trước khi ca bắt đầu.

**Smart Notifications — glue của model:** Notifications không
chỉ là reminder — đó là cơ chế giữ cho cam kết được thực thi.
Nhắc đăng ký lịch trước deadline, alert manager khi lịch thay
đổi, nhắc submit daily report. Không có notifications,
schedule-as-commitment model bị break.

**Same data, two views:** Manager và member nhìn cùng một data
nhưng dưới hai góc độ khác nhau. Manager thấy team overview
và hours analytics để lead bằng sự thật. Member thấy
self-dashboard với anonymous team comparison để tự điều chỉnh
trước khi bị nhắc.

**Trust architecture — accountability không phải surveillance:**
Member biết manager có thể log incidents, và member có quyền
giải thích và appeal. Lịch sử immutable bảo vệ cả hai phía.
Đây không chỉ là feature — đây là design philosophy đảm bảo
member adopt app tự nguyện thay vì vì bị bắt buộc. Mọi
decision về notification wording, data visibility, và
dashboard layout đều phải consistent với philosophy này.

**Timezone-first architecture:** Lưu UTC, hiển thị local.
Hoạt động chính xác cho team đa quốc gia ngay từ ngày đầu,
không cần refactor sau này.

**All-in-one thay vì phân mảnh:** Schedule + daily report +
hours tracking trong một hệ thống. Giảm context switching,
tăng adoption rate.

---

## Project Classification

- **Project Type:** SaaS B2B (phase 1: single-tenant behavior;
  schema: multi-tenant ready từ ngày 1)
- **Domain:** HR Tech / Workforce Management
- **Complexity:** Medium-High (RBAC, timezone handling,
  audit trail, sensitive employee performance data)
- **Project Context:** Greenfield
- **Integrations:** Không có external integrations trong MVP
  — standalone product; phase 2+ mới có Slack, GitHub, v.v.
- **Data Policy:** Hard-persist — không soft-delete; dùng
  status/flag thay vì xóa để đảm bảo audit trail và
  future data export

---

## Success Criteria

### User Success

**Manager:**

| Outcome | Target | Timeline |
|---|---|---|
| Giao task không cần nhắn hỏi trước | Đạt được | Tuần 2 |
| Giảm số lần nhắn "mò" sai giờ | > 80% | Tháng 1 |
| Xác định thành viên ít effort bằng data | Có data rõ ràng | Tháng 1 |
| Có căn cứ cho quyết định nhân sự | ≥ 1 lần | Tháng 3 |

**Member:**

| Outcome | Target | Timeline |
|---|---|---|
| Submit lịch đúng deadline | > 90% các tuần | Tháng 1 |
| Submit daily report | > 85% ngày làm việc | Tháng 1 |
| Tự xem self-dashboard | ≥ 1 lần/tuần | Tháng 1 |
| Tự cập nhật lịch khi thay đổi | Không cần nhắc | Tháng 2 |

**Aha moments:**
- Manager: *"Lần đầu tiên tôi biết chắc ai đang rảnh để
  giao task — không cần nhắn hỏi trước."*
- Member: *"Tôi thấy commitment rate của mình thấp hơn
  mình nghĩ — tự điều chỉnh tuần sau."*

---

### Business Success

**Giai đoạn 1 — Internal validation (0–3 tháng):**
- Team dùng ổn định liên tục sau 3 tháng
- Không có yêu cầu quay về workflow cũ (chat + spreadsheet)
- Manager có ≥ 1 quyết định nhân sự dựa trên data từ app

**Giai đoạn 2 — Multi-tenant (3–12 tháng):**
- 30-day retention > 70% team tiếp tục sau tháng 1
- 90-day retention > 50% team tiếp tục sau 3 tháng

**North Star Metric:**
> Tỷ lệ member tự điều chỉnh commitment rate tuần tiếp
> theo sau khi tuần trước dưới 70% — không cần manager
> nhắc nhở.

---

### Technical Success

| Metric | Target | Ghi chú |
|---|---|---|
| Page load time | < 3s | First contentful paint |
| API response time | < 500ms | p95 cho các actions thông thường |
| Dashboard render | < 2s | Team overview với 15 members |
| Uptime | ≥ 99% | ~7 giờ downtime cho phép/tháng |
| RPO (data loss) | ≤ 24 giờ | Supabase daily backup |
| RTO (recovery) | ≤ 4 giờ | Thời gian restore sau sự cố |
| Concurrent users | ≥ 50 | Headroom cho multi-tenant phase |
| Mobile usability | Core actions < 3 taps | Màn hình 375px width |

**Security requirements:**
- HTTPS everywhere — không có HTTP fallback
- Session timeout: tự động logout sau thời gian inactive
- Password policy: tối thiểu 8 ký tự
- Supabase RLS (Row Level Security) cho tenant data isolation
- Service role key chỉ dùng server-side, không expose client

**Infrastructure:** Supabase (database + auth + storage) +
TanStack Start (frontend/backend) + VPS deployment

---

### Measurable Outcomes (KPIs)

**Product Health (hàng tuần):**

| KPI | Công thức | Target |
|---|---|---|
| Schedule Submission Rate | Submit đúng hạn / tổng member | > 90% |
| Report Completion Rate | Report / ngày làm việc | > 85% |
| Schedule Change Rate | Thay đổi giữa tuần / tổng slot | < 20% |
| Manager DAU | Số ngày manager mở dashboard | Tăng dần |

**Behavior Change (hàng tháng):**

| KPI | Ý nghĩa |
|---|---|
| Commitment Rate avg | Giờ log / giờ cam kết — kỳ vọng tăng dần |
| Self-adjustment Rate | % member tự tăng effort sau tuần thấp |
| Incident Appeal Rate | Đo tính fair của hệ thống — kỳ vọng ổn định |

---

## Product Scope

### MVP — Minimum Viable Product

MVP có thể được deliver theo **phased approach** — nhóm 1-3
trước để validate core loop, nhóm 4-7 tiếp theo. Toàn bộ
7 nhóm phải hoàn thành trước khi gọi là MVP.

**Nhóm 1 — Auth & Foundation**
- Đăng ký, đăng nhập, phân quyền Manager / Member
- Multi-tenant schema (tenant_id) từ ngày 1
- Timezone-first: lưu UTC, hiển thị local

**Nhóm 2 — Schedule Management**
- Weekly schedule registration: multi-slot, grid desktop,
  time picker mobile
- Recurring template từ tuần trước
- Schedule change: ghi lý do bắt buộc, notify manager
- Deadline lock + emergency override với lý do

**Nhóm 3 — Visibility & Dashboard**
- Team Overview Dashboard (manager)
- Mobile quick-view: ai đang online ngay lúc này
- Self-visibility Dashboard (member)

**Nhóm 4 — Daily Report**
- Structured form thay thế chat
- Flexible output type: PR / Figma / doc / khác
- Cross-validation: flag khi giờ log vs task không khớp

**Nhóm 5 — Hours Analytics**
- Committed hours setting per member
- Committed vs actual tracking
- Analytics dashboard: manager view + member self-view

**Nhóm 6 — Notifications**
- Nhắc đăng ký lịch (deadline configurable)
- Nhắc submit daily report
- Alert member chưa đăng ký
- Notify manager khi lịch thay đổi

**Nhóm 7 — Incident Log**
- Manager log thủ công (4 loại + ghi chú)
- Member view + appeal system
- Audit trail immutable

---

### Growth Features (Post-MVP)

- Check-in / Check-out thực tế
- AI tổng hợp và đánh giá daily report
- Multi-tenant UI (self-serve onboarding)
- Data export: CSV / PDF báo cáo nhân sự
- Slack / Discord notifications

---

### Vision (1–2 năm)

TekSpace → Lightweight HR Tool cho startup/agency nhỏ
(5–30 người):
- Performance review dựa trên data có sẵn
- Leave management
- Onboarding checklist
- Billing & subscription management
- API: Slack, Notion, Jira, GitHub

---

## User Journeys

### Journey 1 — Quỳnh · Tuần làm việc điển hình (Member Success Path)

**Nhân vật:** Quỳnh, 21 tuổi, sinh viên CNTT năm 3, part-time
developer cho TekSpace team. Lịch học thay đổi mỗi học kỳ,
thường làm việc ở nhà hoặc tranh thủ tại trường.

**Chủ nhật tối — Đăng ký lịch tuần mới (2 phút)**

Quỳnh nhận notification nhắc đăng ký lịch lúc 8 giờ tối
Chủ nhật. Mở app trên laptop, template tuần trước đã load
sẵn. Tuần này có lịch thi thứ Tư buổi sáng nên Quỳnh xóa
slot 9h-11h ngày đó, giữ nguyên các ngày còn lại. Submit
trong 2 phút.

*Aha moment: "Nhanh hơn mình nghĩ. Tuần sau cũng vậy thôi."*

**Thứ Tư — Thay đổi lịch đột xuất**

Lịch thi kéo dài hơn dự kiến. Quỳnh mở app, chỉnh thêm
slot 13h-15h cũng bị ảnh hưởng, ghi lý do "thi kéo dài".
Manager nhận notification thay đổi tự động — không cần
Quỳnh nhắn riêng.

**Mỗi tối — Submit daily report (3 phút)**

Quỳnh điền form: tasks completed, giờ làm, PR link. Khi
điền "4h làm việc" nhưng chỉ có 1 task nhỏ, app flag:
*"Bạn báo cáo 4h nhưng task có vẻ ít — muốn thêm không?"*
Quỳnh thêm task bị quên vào. Submit.

**Cuối tuần — Xem self-dashboard**

Quỳnh mở self-view: tuần này log 22h / 35h cam kết = 63%.
Team average ẩn danh: 78%. Quỳnh tự nhủ: *"Ít hơn mình
nghĩ. Tuần sau cần sắp xếp tốt hơn."* Không cần manager
nói gì.

**Key behaviors:** Late schedule update sau deadline vẫn
được phép — system không block, chỉ log. Member không bị
mất quyền truy cập khi bỏ lỡ deadline.

---

### Journey 2 — Minh · Ngày làm việc điển hình (Manager Success Path)

**Nhân vật:** Minh, 28 tuổi, developer kiêm team manager,
lần đầu làm quản lý, team 6 người sinh viên remote 100%.

**Buổi sáng — Check team overview (1 phút)**

Minh mở dashboard lúc 8h30. Thấy ngay: Quỳnh làm 9-11h,
Phương làm 14-18h, Hùng off hôm nay. Giao task cho Quỳnh
lúc 9h — không cần nhắn hỏi *"em đang rảnh không?"* trước.

*Aha moment: "Lần đầu tiên tôi biết chắc ai đang rảnh."*

**Giữa tuần — Nhận alert thay đổi lịch**

Notification: *"Quỳnh vừa chỉnh slot 13h-15h thứ Tư.
Lý do: thi kéo dài."* Minh biết ngay, không bị bất ngờ,
không cần hỏi lại.

**Cuối tháng — Review hours analytics**

Minh mở analytics:
- Quỳnh: 22h avg/tuần / 35h cam kết → 63% ⚠️
- Phương: 33h avg/tuần / 35h cam kết → 94% ✅
- Missed response incidents: Quỳnh 4 lần, Phương 1 lần

Minh có data cụ thể để nói chuyện với Quỳnh về commitment.
Cuộc trò chuyện dựa trên số liệu, không phải cảm nhận.

*Aha moment: "Tôi không cần đoán nữa — data nói thay tôi."*

**Key behaviors:** Manager nhận thông tin đầy đủ (lý do
thay đổi) qua notification — không cần hỏi lại. Data
analytics là căn cứ khách quan cho cuộc trò chuyện nhân sự.

---

### Journey 3 — Minh · Setup Team (Onboarding & Admin Path)

**Ngày đầu tiên — Tạo tenant và setup team**

Minh đăng ký TekSpace, tạo tenant *"TekSpace Dev Team"*.
Vào Settings, cấu hình:
- Deadline đăng ký lịch: mỗi Chủ nhật 11:59 PM
- Committed hours mặc định: 35h/tuần
- Timezone team: Asia/Ho_Chi_Minh

Invite 5 thành viên qua email. Mỗi người nhận link
onboarding, đăng ký tài khoản, điền timezone cá nhân.

**Tuần đầu — Adjust per member**

Sau khi team join, Minh vào từng member profile, chỉnh
committed hours cho Hùng xuống 20h/tuần vì Hùng đang
ôn thi. Thay đổi này ảnh hưởng ngay đến commitment rate
calculation của Hùng.

**Key behaviors:** Tenant creation là first action sau
đăng ký — không có "empty state". Per-member settings
override team defaults và có hiệu lực ngay lập tức.

---

### Journey 4 — Quỳnh · Bỏ lỡ deadline đăng ký lịch (Edge Case)

**Chủ nhật — Quỳnh quên đăng ký lịch**

11:59 PM Chủ nhật — deadline qua, Quỳnh chưa đăng ký.
App tự động tạo **lịch trống** cho tuần mới của Quỳnh.
Gửi notification cho Quỳnh: *"Bạn chưa đăng ký lịch tuần
này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."*
Gửi notification cho Minh: *"Quỳnh chưa đăng ký lịch
tuần mới."*

**Thứ Hai sáng — Quỳnh cập nhật lịch muộn**

Quỳnh mở app, thấy lịch trống, điền lịch bình thường.
Không bị khóa tài khoản hay mất quyền truy cập. Minh
thấy lịch của Quỳnh đã có data từ thứ Hai. Incident
"chưa đăng ký đúng hạn" được Minh log thủ công nếu muốn
ghi nhận.

**Key behaviors:** Incident log là manual — system không
tự động log. Member không bị khóa tài khoản hay mất
quyền truy cập khi bỏ lỡ deadline.

---

### Journey 5 — Lan · Daily Report của Designer (Secondary User)

**Nhân vật:** Lan, 22 tuổi, sinh viên Design, part-time
UI designer trong cùng team. Không có PR link, output là
Figma và design specs.

**Mỗi tối — Submit daily report**

Lan mở form daily report. Thay vì PR link, chọn output
type *"Design"*, paste Figma link + ghi chú ngắn.
Cross-validation vẫn hoạt động: nếu log 5h nhưng chỉ có
1 frame Figma, app flag để Lan xác nhận. Minh xem report
của Lan trên dashboard — thấy Figma link trực tiếp,
click vào xem được ngay.

**Key behaviors:** Output type selector thay đổi theo
role — designer không bị ép dùng PR link. Manager xem
output links trực tiếp từ dashboard, không cần hỏi.

---

### Journey Requirements Summary

| Capability Area | Revealed by Journey |
|---|---|
| Schedule registration + recurring template | J1, J3 |
| Schedule change + manager notification | J1, J2 |
| Auto-create empty schedule on missed deadline | J4 |
| Dual notification member + manager | J4 |
| Team dashboard + timezone toggle | J2 |
| Mobile quick-view (ai đang online) | J2 |
| Self-dashboard + anonymous team comparison | J1 |
| Daily report form + cross-validation | J1, J5 |
| Flexible output type | J5 |
| Manager view output links from dashboard | J5 |
| Hours analytics + commitment rate | J2 |
| Incident log (manual by manager) | J2, J4 |
| Tenant creation + team settings | J3 |
| Member invite + per-member settings | J3 |

---

## Domain-Specific Requirements

### Authorization Model (RBAC)

3 roles, per-tenant — 1 email có thể có role khác nhau
ở các tenant khác nhau:

| Role | Quyền |
|---|---|
| **Owner** | Tạo/xóa tenant, promote Manager, full settings, mọi quyền của Manager |
| **Manager** | Xem team dashboard, log incidents, invite/remove members, per-member settings, xem analytics |
| **Member** | Đăng ký lịch, submit daily report, xem self-dashboard, appeal incidents |

**Schema pattern:**
- `users` table: account-level data (email, password, timezone)
- `tenant_members` junction table: (user_id, tenant_id, role)
  → Role gắn với tenant, không phải global
- 1 user có thể là Owner ở Tenant A, Member ở Tenant B
- UI cần **tenant switcher**: tên tenant hiện tại visible
  ở mọi trang, accessible ≤ 2 clicks từ bất kỳ đâu

**Ownership rules:**
- Owner không thể rời tenant hoặc xóa account nếu là
  sole Owner — phải transfer ownership hoặc xóa tenant trước
- Prevents orphaned tenants với không có owner

**Session management:**
- Khi Owner remove một member: session invalidated **immediately**
  via `auth.admin.signOut(userId)` — không có grace period
- Member nhận friendly toast notification khi bị remove
  (thay vì blank error) — consistent với trust architecture
  philosophy

---

### Data Privacy

**Employee data classification:** Sensitive — hours worked,
commitment rates, incident history, daily work output.

**Access control rules:**
- Member chỉ xem data của chính mình
- Manager/Owner xem data toàn bộ team trong tenant
- Cross-tenant data hoàn toàn isolated (Supabase RLS)
- Anonymous comparison trong self-dashboard: member thấy
  team average nhưng không biết của ai

**Data retention:**
- MVP: Giữ tất cả data, không auto-delete
- Future: Configurable retention policy per tenant

**Inactive members (rời team):**
- Status: `active` → `inactive` (hard-persist pattern)
- Ẩn khỏi active team view
- Data (report, hours, incidents) vẫn giữ nguyên
- Owner/Manager vẫn có thể query historical data

**GDPR / Right to be forgotten:**
- Chưa implement trong MVP
- Future Considerations: manual process nếu có request

---

### Technical Constraints

**Timezone handling:**
- Tất cả timestamps lưu UTC trong database
- Hiển thị theo timezone của từng user (stored in `users`)
- Team timezone trong settings chỉ dùng cho default display
- Schedule slots: lưu UTC start/end, render local

**Schedule slot granularity:**
- Mỗi slot là một khoảng thời gian liên tục với start_time
  và end_time tự do (không ép granularity cố định)
- UI picker: bước nhảy 30 phút (HH:00 hoặc HH:30)
  để đảm bảo input nhất quán
- Một member có thể đăng ký nhiều slots trong cùng
  một ngày (ví dụ: 9:00-11:30 và 14:00-17:00)
- **Overnight slots được hỗ trợ:** slot có thể kết
  thúc vào ngày hôm sau (ví dụ: 22:00 thứ Hai đến
  02:00 thứ Ba); slot thuộc về ngày bắt đầu (thứ Hai)
  cho mục đích hiển thị dashboard và tính hours
- Lưu trữ: UTC start_time + duration_minutes
  (tránh ambiguity khi end_time qua midnight)
- Minimum slot duration: 30 phút; maximum: 12 giờ
  (guard against accidental overnight wrap)
- Overlap check: tính theo UTC absolute time —
  hai slots của cùng một member không được overlap
  dù có qua midnight

**Audit trail requirements:**
- Incident log: immutable — không update, không delete
- Schedule changes: log đầy đủ change history với reason
- Appeal actions: log với timestamp và outcome
- Hard-persist: dùng status/flag, không soft-delete bất cứ thứ gì

**Multi-tenancy:**
- tenant_id present trên tất cả data tables
- Supabase RLS enforce isolation ở database level
- Application layer không được là security boundary duy nhất
- Service role key: server-side only, không expose client

---

### Risk Mitigations

| Rủi ro | Mitigation |
|---|---|
| Manager xem data nhạy cảm của member | Anonymous comparison, chỉ show aggregate khi cần |
| Tenant data leak | Supabase RLS + server-side validation double-check |
| Member bị incident oan | Appeal system + immutable audit trail bảo vệ cả 2 phía |
| Owner xóa tenant → mất data team | Soft-deactivate tenant trước, hard-delete sau confirm |
| User quên tenant nào mình đang ở | Tenant name visible mọi trang, switcher ≤ 2 clicks |
| Orphaned tenant (không có owner) | Block account deletion nếu user là sole Owner |
| Member bị remove đột ngột | Immediate session invalidation + friendly toast notification |

---

## SaaS B2B Specific Requirements

### Project-Type Overview

TekSpace là SaaS B2B phục vụ remote teams trong domain
hr_tech/workforce_management. Phase 1 là single-tenant
internal tool; schema multi-tenant ready từ ngày 1 để
scale không cần refactor.

---

### Multi-Tenancy Architecture

**Model:** Single database, shared schema, tenant isolation
qua `tenant_id` column + Supabase RLS.

**Tenant lifecycle:**
- Owner đăng ký → tạo tenant → invite members
- Tenant có thể deactivated (soft) trước khi deleted (hard)
- Orphaned tenant prevention: block delete nếu sole Owner

**Data isolation:**
- tenant_id present trên tất cả data tables
- RLS policies enforce isolation ở database level
- Application layer validate thêm — không phải
  single point of failure

---

### Permission Summary

*Owner và Manager cũng là member của team — họ có tất cả
quyền của Member. Permission matrix đầy đủ ở Domain
Requirements → Authorization Model.*

---

### Onboarding Flow

**Owner onboarding (Tenant creation):**
1. Đăng ký tài khoản
2. Tạo tenant (team name, timezone, notification deadline)
3. Set default committed hours
4. Invite members via email

**Member onboarding (Invite flow):**
1. Nhận invite email qua Resend
2. Click link → đăng ký tài khoản (hoặc login nếu đã có)
3. **Explicit "Accept & Join" step** — kể cả khi đã
   authenticated ở tenant khác, phải confirm join
4. Join tenant với role Member
5. Set timezone cá nhân
6. Redirect đến schedule registration tuần hiện tại

**Invite expiry:**
- Invite link expire sau **48 giờ**
- Expired link → friendly error message:
  *"Lời mời đã hết hạn. Vui lòng liên hệ manager để được
  invite lại."*
- Không có auto-notification khi expire — Owner/Manager
  resend thủ công nếu cần

**Multi-tenant UX:**
- User có nhiều tenant memberships → tenant switcher
  visible ở mọi trang
- Current tenant name always displayed
- Tenant switcher accessible ≤ 2 clicks

---

### Email Infrastructure

**Provider:** Resend

**Transactional emails:**

| Email type | Trigger | Recipient |
|---|---|---|
| Invite to team | Owner/Manager invite | New member |
| Welcome to tenant | Member accepts invite | Member |
| Schedule deadline reminder | Cron job trước deadline | Member chưa submit |
| Schedule missed notification | Post-deadline | Member + Manager |
| Schedule change alert | Member thay đổi lịch | Manager |
| Daily report reminder | Cron job tối hàng ngày | Member chưa submit |
| Session invalidated | Owner remove member | Member bị remove |

*In-app notifications: tất cả các loại trên đều có
in-app version. Email là supplement, không phải replacement.*

*Scale note: Khi multi-tenant, cron notification jobs
cần batch sending để tránh Resend rate limits.*

---

### Billing & Subscription

- MVP: Không có billing — internal tool, single tenant
- Phase 2+: Model chưa xác định
  *(freemium / flat fee / per-seat — quyết định sau
  khi validate product-market fit)*
- Future Considerations: Integrate billing (Stripe) khi
  multi-tenant go-live

---

### Implementation Considerations

**Tech stack:**
- Frontend/Backend: TanStack Start
- Database + Auth + Storage: Supabase
- Email: Resend
- Deployment: VPS

**Key SaaS patterns cần implement:**
- Tenant context middleware — inject tenant_id vào
  mọi request từ authenticated session
- RLS helper function `current_tenant_id()` để
  standardize policies
- Email templates với Resend — branded, responsive
- Cron jobs cho notification triggers:
  **Supabase `pg_cron`** là preferred approach cho MVP
  (chạy trong database layer, không cần external service)

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — ship đúng thứ
giải quyết core pain (manager không biết ai làm giờ nào,
member thiếu accountability), không thêm gì chưa cần thiết.

**Validation target:** Team Thắng dùng ổn định liên tục
sau 3 tháng, không có yêu cầu quay về chat + spreadsheet.

**Resource:** Solo developer + AI coding agents
**Target timeline:** 3-5 ngày với parallel agent strategy
**Stretch goal:** 1-2 ngày cho Phase 1a (Nhóm 1-3)

---

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- J1: Quỳnh đăng ký lịch tuần, submit daily report,
  xem self-dashboard
- J2: Minh xem team overview, nhận alert, review analytics
- J3: Minh setup tenant, invite members
- J4: Auto-handle missed schedule deadline
- J5: Lan submit daily report với flexible output type

*Feature list đầy đủ ở Product Scope → MVP section.*

**Phased delivery:**
- **Phase 1a** (1-2 ngày): Nhóm 1-3 → validate core loop
- **Phase 1b** (2-3 ngày thêm): Nhóm 4-7 → complete MVP

---

### Post-MVP & Vision

*Xem Product Scope → Growth Features và Vision.*

---

### Risk Mitigation Strategy

**Technical Risks:**

| Rủi ro | Mitigation |
|---|---|
| RLS bugs với AI coding agents | `rls-policies.sql` + `current_tenant_id()` helper define trước; Architecture Document có RLS patterns chuẩn cho agents follow |
| Multi-tenant data leak | RLS ở database level + server-side double-check; client-side không phải sole security boundary |
| Schema conflicts khi parallel agents | Define và migrate schema đầy đủ trước khi spawn parallel agents; tất cả agents dùng chung một schema source |
| Inconsistent code patterns từ parallel agents | Architecture Document phải có coding conventions section — naming, error handling, API response format; Story specs reference conventions explicitly |
| Timezone bugs | Luôn lưu UTC, test với ít nhất 2 timezone khác nhau |

**Market Risks:**

| Rủi ro | Mitigation |
|---|---|
| Team không adopt app | Founder = user → built-in validation; dogfood với chính team Thắng trước |
| Members không chịu submit lịch | Friction thấp (template từ tuần trước, 2 phút), notifications đúng thời điểm |
| Manager không mở app hàng ngày | Dashboard cung cấp value ngay lần đầu mở (ai đang online) |

**Resource Risks:**

| Rủi ro | Mitigation |
|---|---|
| Timeline trễ | Phase 1a (Nhóm 1-3) là deliverable độc lập — nếu trễ, vẫn có core value để dùng |
| AI agent bị block | PRD + Architecture Document đầy đủ = agents ít bị block nhất; decisions pre-made |
| Parallel agent merge conflicts | Nhóm 1 (schema + auth) phải serial-complete trước khi spawn parallel agents |

**Parallel Agent Implementation Strategy:**

```
Phase 0 (serial):   Nhóm 1 — Auth + Schema + RLS
                        ↓ Schema locked
Phase 1a (parallel): Agent A → Nhóm 2 (Schedule)
                     Agent B → Nhóm 3 (Dashboard + mock data)
                        ↓ Merge + integration test
Phase 1b (parallel): Agent C → Nhóm 4 (Daily Report)
                     Agent D → Nhóm 5 (Analytics)
                     Agent E → Nhóm 6 (Notifications)
                     Agent F → Nhóm 7 (Incident Log)
                        ↓ Merge → MVP complete
```

*Prerequisite cho parallel strategy: Architecture Document
với database schema + coding conventions phải hoàn thành
trước khi bắt đầu coding.*

---

## Functional Requirements

### 1. Account & Identity Management

- FR1: User có thể đăng ký tài khoản mới bằng email
  và password
- FR2: User có thể đăng nhập vào tài khoản của mình
- FR3: User có thể thiết lập timezone cá nhân
- FR4: User có thể xem và chuyển đổi giữa các tenant
  membership của mình
- FR5: System invalidate session ngay lập tức khi user
  bị remove khỏi tenant
- FR50: User có thể request reset password qua email —
  system gửi link reset có thời hạn 1 giờ; sau khi
  dùng hoặc hết hạn, link bị vô hiệu hóa
- FR51: User đã đăng nhập có thể đổi password bằng
  cách xác nhận password hiện tại trước khi đặt
  password mới
- FR53: User có thể upload avatar cá nhân; avatar hiển
  thị trong sidebar và danh sách thành viên

---

### 2. Tenant & Team Management

- FR6: Owner có thể tạo tenant mới (team)
- FR7: Owner có thể cấu hình team settings (schedule
  deadline, daily report deadline, default committed
  hours, team timezone)
- FR54: Owner có thể upload logo/avatar cho tenant;
  logo hiển thị trong sidebar tenant switcher
- FR8: Owner và Manager có thể invite member vào tenant
  qua email
- FR9: Owner và Manager có thể remove member khỏi tenant
- FR10: Owner có thể promote Member lên role Manager
- FR11: Owner có thể transfer ownership cho member khác
- FR12: Owner không thể xóa tài khoản nếu là sole Owner
  của bất kỳ tenant nào
- FR13: Invited user nhận email invite với link có thời
  hạn 48 giờ
- FR14: Member có thể accept invitation để join tenant
  qua explicit confirmation step
- FR49: Owner và Manager có thể xem trạng thái pending
  invitations (pending / accepted / expired) và resend
  invite nếu cần

---

### 3. Schedule Management

- FR15: Member có thể đăng ký lịch làm việc tuần dưới
  dạng time slots
- FR16: Member có thể load lịch tuần trước làm template
  cho tuần hiện tại
- FR17: System tự động tạo lịch trống cho member không
  submit trước deadline
- FR18: Member có thể chỉnh sửa lịch đã đăng ký kèm
  lý do bắt buộc
- FR19: System khóa chỉnh sửa lịch trước khi ca làm
  việc bắt đầu (deadline lock)
- FR20: Member có thể yêu cầu emergency override lịch
  đã khóa kèm lý do bắt buộc
- FR21: System notify Manager khi member thay đổi lịch
  đã đăng ký

---

### 4. Team Visibility & Dashboard

- FR22: Manager và Owner có thể xem tổng quan lịch làm
  việc tuần của cả team
- FR23: Manager và Owner có thể xem member nào đang
  trong giờ làm việc đã đăng ký theo thời gian thực
- FR24: Manager và Owner có thể xem lịch team theo
  nhiều timezone khác nhau

---

### 5. Self-Visibility & Personal Analytics

- FR25: Member có thể xem lịch, hours log, và metrics
  cá nhân của mình
- FR26: Member có thể xem commitment rate của mình
  (actual hours / committed hours)
- FR27: Member có thể xem so sánh ẩn danh metrics của
  mình so với team average

---

### 6. Daily Report

- FR28: Member có thể submit daily report có cấu trúc
  gồm completed tasks, hours logged, và work outputs
- FR29: Member có thể chọn output type cho từng task
  (PR, Figma, document, other)
- FR30: Member có thể đính kèm link work output vào
  daily report
- FR31: System có thể flag potential discrepancies trong
  daily report để member review trước khi submit
- FR32: Manager và Owner có thể xem daily report của
  tất cả team members
- FR52: Daily report deadline có thể được cấu hình
  bởi Owner/Manager trong team settings (mặc định:
  03:00 sáng ngày hôm sau theo team timezone, hỗ trợ
  cài bất kỳ giờ nào trong ngày); submit sau deadline
  vẫn được chấp nhận nhưng được đánh dấu "late" —
  visible với Manager, không block member

---

### 7. Hours Tracking & Analytics

- FR33: Owner và Manager có thể set committed hours
  target cho từng member
- FR33b: Mỗi lần committed hours được thay đổi, system
  lưu lịch sử thay đổi (effective_from, effective_to) —
  không ghi đè giá trị cũ. Analytics sử dụng đúng giá
  trị committed hours của từng kỳ tương ứng.
- FR34: System theo dõi actual hours của mỗi member
  so với committed hours target
- FR35: Manager và Owner có thể xem hours analytics
  tổng quan của cả team
- FR36: Manager và Owner có thể xem analytics theo
  từng member theo thời gian
- FR37: Member có thể xem lịch sử hours analytics và
  commitment rate của bản thân

---

### 8. Notifications

- FR38: System nhắc member trước deadline đăng ký lịch
- FR39: System notify member và Manager khi deadline
  đăng ký lịch bị bỏ lỡ
- FR40: System nhắc member submit daily report
- FR41: System notify Manager khi member chỉnh sửa
  lịch đã đăng ký
- FR42: System notify member bị remove với thông báo
  thân thiện khi session bị invalidate
- FR43: Tất cả notifications được deliver qua cả
  in-app và email (Resend); khi user đang ở tab khác,
  system có thể gửi browser push notification (opt-in)
  và hiển thị unread count trên browser tab title

---

### 9. Incident Management

- FR44: Manager và Owner có thể log incident cho member
  với category và ghi chú
- FR45: Member có thể xem incidents được log cho mình
- FR46: Member có thể submit appeal response cho
  một incident
- FR47: System duy trì immutable audit trail của tất cả
  incidents và appeal actions
- FR48: Manager và Owner có thể xem toàn bộ incident
  history của team

---

## Non-Functional Requirements

### Performance

- NFR1: First Contentful Paint (FCP) của mọi trang
  phải < 3 giây trên kết nối 4G
- NFR2: API response time phải < 500ms ở p95 cho
  tất cả user-initiated actions
- NFR3: Team dashboard render phải < 2 giây với
  tối đa 15 members
- NFR4: Schedule registration form phải respond
  < 1 giây sau user interaction

---

### Security

- NFR5: Tất cả traffic phải qua HTTPS —
  không có HTTP fallback
- NFR6: Tất cả data phải được mã hóa at-rest
  và in-transit
- NFR7: Session phải tự động expire sau **24 giờ**
  inactive
- NFR8: Password phải tối thiểu 8 ký tự
- NFR9: Tenant data phải hoàn toàn isolated —
  một tenant không thể access data của tenant khác
- NFR10: Service role key chỉ được phép dùng
  server-side, không expose ra client
- NFR11: Tất cả user inputs phải được validate
  và sanitize trước khi xử lý
- NFR12: API phải có rate limiting để ngăn chặn
  abuse và brute force attacks
- NFR13: System-level admin actions (remove member,
  promote role, transfer ownership) phải được log
  với actor và timestamp

---

### Reliability

- NFR14: System uptime phải ≥ 99% (tương đương
  ≤ 7 giờ downtime mỗi tháng)
- NFR15: Recovery Point Objective (RPO) phải
  ≤ 24 giờ — mất tối đa 24 giờ data khi sự cố
- NFR16: Recovery Time Objective (RTO) phải
  ≤ 4 giờ — restore trong vòng 4 giờ sau sự cố
- NFR17: Cron jobs (schedule deadline, daily
  report reminder) phải có retry mechanism
  khi thất bại

---

### Scalability

- NFR18: System phải hỗ trợ tối thiểu 50
  concurrent users không có performance degradation
- NFR19: Database schema phải multi-tenant ready
  từ ngày 1 — không cần migration khi scale
- NFR20: Architecture phải support thêm tenants
  mới mà không cần downtime hoặc schema changes
- NFR21: Email delivery (Resend) phải dùng
  batch sending khi gửi notification đến nhiều
  members cùng lúc để tránh rate limits

