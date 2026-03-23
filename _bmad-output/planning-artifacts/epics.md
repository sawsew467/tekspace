---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - prd.md
  - architecture.md
---

# TekSpace - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TekSpace, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User có thể đăng ký tài khoản mới bằng email và password
FR2: User có thể đăng nhập vào tài khoản của mình
FR3: User có thể thiết lập timezone cá nhân
FR4: User có thể xem và chuyển đổi giữa các tenant membership của mình
FR5: System invalidate session ngay lập tức khi user bị remove khỏi tenant
FR50: User có thể request reset password qua email — system gửi link reset có thời hạn 1 giờ; sau khi dùng hoặc hết hạn, link bị vô hiệu hóa
FR51: User đã đăng nhập có thể đổi password bằng cách xác nhận password hiện tại trước khi đặt password mới
FR6: Owner có thể tạo tenant mới (team)
FR7: Owner có thể cấu hình team settings (schedule deadline, daily report deadline, default committed hours, team timezone)
FR8: Owner và Manager có thể invite member vào tenant qua email
FR9: Owner và Manager có thể remove member khỏi tenant
FR10: Owner có thể promote Member lên role Manager
FR11: Owner có thể transfer ownership cho member khác
FR12: Owner không thể xóa tài khoản nếu là sole Owner của bất kỳ tenant nào
FR13: Invited user nhận email invite với link có thời hạn 48 giờ
FR14: Member có thể accept invitation để join tenant qua explicit confirmation step
FR49: Owner và Manager có thể xem trạng thái pending invitations (pending / accepted / expired) và resend invite nếu cần
FR15: Member có thể đăng ký lịch làm việc tuần dưới dạng time slots
FR16: Member có thể load lịch tuần trước làm template cho tuần hiện tại
FR17: System tự động tạo lịch trống cho member không submit trước deadline
FR18: Member có thể chỉnh sửa lịch đã đăng ký kèm lý do bắt buộc
FR19: System khóa chỉnh sửa lịch trước khi ca làm việc bắt đầu (deadline lock)
FR20: Member có thể yêu cầu emergency override lịch đã khóa kèm lý do bắt buộc
FR21: System notify Manager khi member thay đổi lịch đã đăng ký
FR22: Manager và Owner có thể xem tổng quan lịch làm việc tuần của cả team
FR23: Manager và Owner có thể xem member nào đang trong giờ làm việc đã đăng ký theo thời gian thực
FR24: Manager và Owner có thể xem lịch team theo nhiều timezone khác nhau
FR25: Member có thể xem lịch, hours log, và metrics cá nhân của mình
FR26: Member có thể xem commitment rate của mình (actual hours / committed hours)
FR27: Member có thể xem so sánh ẩn danh metrics của mình so với team average
FR28: Member có thể submit daily report có cấu trúc gồm completed tasks, hours logged, và work outputs
FR29: Member có thể chọn output type cho từng task (PR, Figma, document, other)
FR30: Member có thể đính kèm link work output vào daily report
FR31: System có thể flag potential discrepancies trong daily report để member review trước khi submit
FR32: Manager và Owner có thể xem daily report của tất cả team members
FR52: Daily report deadline có thể được cấu hình bởi Owner/Manager trong team settings (mặc định: 03:00 sáng ngày hôm sau theo team timezone); submit sau deadline vẫn được chấp nhận nhưng được đánh dấu "late"
FR33: Owner và Manager có thể set committed hours target cho từng member
FR34: System theo dõi actual hours của mỗi member so với committed hours target
FR35: Manager và Owner có thể xem hours analytics tổng quan của cả team
FR36: Manager và Owner có thể xem analytics theo từng member theo thời gian
FR37: Member có thể xem lịch sử hours analytics và commitment rate của bản thân
FR38: System nhắc member trước deadline đăng ký lịch
FR39: System notify member và Manager khi deadline đăng ký lịch bị bỏ lỡ
FR40: System nhắc member submit daily report
FR41: System notify Manager khi member chỉnh sửa lịch đã đăng ký
FR42: System notify member bị remove với thông báo thân thiện khi session bị invalidate
FR43: Tất cả notifications được deliver qua cả in-app và email (Resend)
FR44: Manager và Owner có thể log incident cho member với category và ghi chú
FR45: Member có thể xem incidents được log cho mình
FR46: Member có thể submit appeal response cho một incident
FR47: System duy trì immutable audit trail của tất cả incidents và appeal actions
FR48: Manager và Owner có thể xem toàn bộ incident history của team

### NonFunctional Requirements

NFR1: First Contentful Paint (FCP) của mọi trang phải < 3 giây trên kết nối 4G
NFR2: API response time phải < 500ms ở p95 cho tất cả user-initiated actions
NFR3: Team dashboard render phải < 2 giây với tối đa 15 members
NFR4: Schedule registration form phải respond < 1 giây sau user interaction
NFR5: Tất cả traffic phải qua HTTPS — không có HTTP fallback
NFR6: Tất cả data phải được mã hóa at-rest và in-transit
NFR7: Session phải tự động expire sau 24 giờ inactive
NFR8: Password phải tối thiểu 8 ký tự
NFR9: Tenant data phải hoàn toàn isolated — một tenant không thể access data của tenant khác
NFR10: Service role key chỉ được phép dùng server-side, không expose ra client
NFR11: Tất cả user inputs phải được validate và sanitize trước khi xử lý
NFR12: API phải có rate limiting để ngăn chặn abuse và brute force attacks
NFR13: System-level admin actions (remove member, promote role, transfer ownership) phải được log với actor và timestamp
NFR14: System uptime phải ≥ 99% (tương đương ≤ 7 giờ downtime mỗi tháng)
NFR15: Recovery Point Objective (RPO) phải ≤ 24 giờ — mất tối đa 24 giờ data khi sự cố
NFR16: Recovery Time Objective (RTO) phải ≤ 4 giờ — restore trong vòng 4 giờ sau sự cố
NFR17: Cron jobs (schedule deadline, daily report reminder) phải có retry mechanism khi thất bại
NFR18: System phải hỗ trợ tối thiểu 50 concurrent users không có performance degradation
NFR19: Database schema phải multi-tenant ready từ ngày 1 — không cần migration khi scale
NFR20: Architecture phải support thêm tenants mới mà không cần downtime hoặc schema changes
NFR21: Email delivery (Resend) phải dùng batch sending khi gửi notification đến nhiều members cùng lúc để tránh rate limits

### Additional Requirements

- **Starter Template (Architecture):** Clone SpeakPing-Admin làm base project; không phải greenfield từ đầu — đây là Story đầu tiên trong Phase 0 (Epic 1, Story 1)
- **Phase 0 Serial Setup (phải hoàn thành trước khi spawn parallel agents):**
  - Supabase project configuration: Auth (Site URL + Redirect URLs, email confirmation disabled)
  - Custom Access Token Hook (`custom_access_token_hook` function) để embed `tenant_roles` vào JWT
  - Extensions: `pg_cron`, `pg_net` enabled
  - Database `app.settings`: `app.edge_function_url` + `app.service_role_key`
  - Database schema migrations (13 migration files cho tất cả tables)
  - RLS policies cho tất cả tables (dùng `current_tenant_id()` helper)
  - pg_cron jobs scheduled (4 jobs: remind-schedule-submission, auto-create-empty-schedule, remind-daily-report, deadline-missed-notify)
  - Edge Functions deployed: `remove-member`, `notify-schedule-change`, `send-invite`, `notify-schedule-reminder`
  - Supabase Secrets: `RESEND_API_KEY`, `APP_URL`
- **Frontend Foundation (shared libs, phải setup trước parallel agents):**
  - `src/lib/supabase-browser.ts` (Supabase client singleton)
  - `src/lib/supabase-types.ts` (generated types từ Supabase CLI)
  - `src/lib/query-client.ts` (QueryClient + global error handler)
  - `src/lib/permissions.ts` (RBAC helpers + Permission types đầy đủ)
  - `src/lib/routes.ts` (ROUTES constant)
  - `src/lib/query-keys.ts` (QUERY_KEYS constant)
  - `src/stores/auth-store.ts` (Zustand + Supabase session)
  - `src/stores/tenant-store.ts` (Zustand tenant context)
  - `src/routes/_app.tsx` (layout + auth guard)
  - `src/routes/sign-in.tsx` (auth flow hoàn chỉnh)
- **Notification Infrastructure:** Dual delivery (in-app notifications table + Resend email) cho tất cả 7 loại trigger; time-based triggers qua `pg_cron`, event-based triggers qua Supabase Edge Functions
- **Timezone-first Architecture:** Tất cả timestamps lưu UTC; schedule slots dùng `start_time (UTC) + duration_minutes`; display theo `users.timezone`; overnight slots thuộc ngày bắt đầu
- **Audit Trail (Append-Only):** Incidents, schedule changes, appeals là immutable inserts — không UPDATE, không DELETE
- **Multi-tenancy Enforcement:** `tenant_id` present trên tất cả data tables; RLS là source of truth; application layer validate thêm

### UX Design Requirements

_Không có UX Design document trong dự án này. Các yêu cầu UX được tích hợp trực tiếp vào PRD (Journey Requirements, Trust Architecture, Schedule-as-commitment model)._

### FR Coverage Map

FR1: Epic 1 — Đăng ký tài khoản mới bằng email và password
FR2: Epic 1 — Đăng nhập vào tài khoản
FR3: Epic 1 — Thiết lập timezone cá nhân
FR4: Epic 1 — Xem và chuyển đổi tenant membership
FR5: Epic 1 — Session invalidation khi bị remove khỏi tenant
FR50: Epic 1 — Reset password qua email (link 1 giờ)
FR51: Epic 1 — Đổi password (xác nhận password cũ)
FR6: Epic 1 — Tạo tenant mới
FR7: Epic 1 — Cấu hình team settings (deadline, hours, timezone)
FR8: Epic 1 — Invite member qua email
FR9: Epic 1 — Remove member khỏi tenant
FR10: Epic 1 — Promote Member lên Manager
FR11: Epic 1 — Transfer ownership
FR12: Epic 1 — Block delete nếu là sole Owner
FR13: Epic 1 — Invite link có thời hạn 48 giờ
FR14: Epic 1 — Accept invitation (explicit confirmation step)
FR49: Epic 1 — Xem pending invitations + resend invite
FR15: Epic 2 — Đăng ký lịch làm việc tuần dưới dạng time slots
FR16: Epic 2 — Load template từ lịch tuần trước
FR17: Epic 2 — Auto-create lịch trống khi bỏ lỡ deadline
FR18: Epic 2 — Chỉnh sửa lịch đã đăng ký (lý do bắt buộc)
FR19: Epic 2 — Deadline lock trước khi ca bắt đầu
FR20: Epic 2 — Emergency override lịch đã khóa (lý do bắt buộc)
FR21: Epic 2 — Notify Manager khi member thay đổi lịch
FR22: Epic 3 — Team overview dashboard (manager view)
FR23: Epic 3 — Real-time "ai đang online" view
FR24: Epic 3 — Timezone toggle cho team dashboard
FR25: Epic 3 — Self-dashboard (lịch + hours log + metrics cá nhân)
FR26: Epic 3 — Commitment rate cá nhân (actual / committed)
FR27: Epic 3 — Anonymous team comparison trong self-dashboard
FR28: Epic 4 — Submit daily report có cấu trúc
FR29: Epic 4 — Chọn output type (PR / Figma / document / other)
FR30: Epic 4 — Đính kèm work output links
FR31: Epic 4 — Cross-validation flag (giờ vs task discrepancy)
FR32: Epic 4 — Manager xem daily reports của cả team
FR52: Epic 4 — Configurable daily report deadline + late marking
FR33: Epic 5 — Set committed hours target per member
FR34: Epic 5 — Track actual hours vs committed target
FR35: Epic 5 — Team hours analytics tổng quan (manager view)
FR36: Epic 5 — Per-member analytics theo thời gian (manager view)
FR37: Epic 5 — Member self-history analytics và commitment rate
FR38: Epic 6 — Nhắc đăng ký lịch trước deadline
FR39: Epic 6 — Notify member + Manager khi bỏ lỡ deadline đăng ký
FR40: Epic 6 — Nhắc submit daily report
FR41: Epic 6 — Alert Manager khi member chỉnh sửa lịch
FR42: Epic 6 — Notify member bị remove (friendly toast khi session invalidated)
FR43: Epic 6 — Dual delivery in-app + email (Resend) cho tất cả notifications
FR44: Epic 7 — Manager log incident (category + ghi chú)
FR45: Epic 7 — Member xem incidents được log cho mình
FR46: Epic 7 — Member submit appeal response
FR47: Epic 7 — Immutable audit trail (incidents + appeals)
FR48: Epic 7 — Manager xem toàn bộ incident history của team

## Epic List

### Epic 1: Foundation & Team Onboarding
Team có thể được setup đầy đủ và tất cả thành viên có thể truy cập hệ thống với đúng quyền của mình — từ project initialization cho đến member onboarding hoàn chỉnh.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR49, FR50, FR51
**Technical notes:** Story đầu tiên là project setup (clone SpeakPing-Admin + Supabase foundation). Thứ tự stories phải serial: Setup → Auth → Tenant → Invite/Roles. Đây là Phase 0 — phải hoàn thành trước khi spawn parallel agents cho các epics sau.

### Epic 2: Schedule Registration
Member có thể đăng ký lịch làm việc tuần, load template từ tuần trước để tiết kiệm thời gian, chỉnh sửa khi cần thiết — và hệ thống tự xử lý gracefully khi deadline bị bỏ lỡ.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21
**Technical notes:** Core loop của schedule-as-commitment model. Cần timezone handling chính xác (UTC + duration_minutes). Overnight slots supported. Schedule change history là append-only (audit trail).

### Epic 3: Team Visibility & Self-Dashboard
Manager thấy rõ cả team đang làm gì theo thời gian thực — và mỗi member tự theo dõi performance của mình, bao gồm so sánh ẩn danh với team average để tự điều chỉnh.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27
**Technical notes:** "Who is online" = so sánh current UTC time với schedule_slots (không cần WebSocket cho MVP, dùng refetchInterval). Anonymous comparison là server-side aggregate — không bao giờ trả về individual records.

### Epic 4: Daily Report
Member có thể submit báo cáo có cấu trúc hàng ngày với output type linh hoạt (PR, Figma, document, other) — và manager xem được toàn bộ output của team từ một nơi.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR52
**Technical notes:** Cross-validation flag là suggestion, không block submit. Late marking dựa trên configurable deadline (default 03:00 sáng ngày hôm sau theo team timezone). Report là append-only (không edit sau submit).

### Epic 5: Hours Analytics
Manager có data khách quan để đánh giá commitment của từng thành viên theo thời gian — và member tự xem được lịch sử performance của mình để tự điều chỉnh trước khi bị nhắc.
**FRs covered:** FR33, FR34, FR35, FR36, FR37
**Technical notes:** Committed hours setting per member (override team default). Actual hours tính từ daily_reports. Analytics là read-only views (không có write operations). Charts/trends theo tuần/tháng.

### Epic 6: Smart Notifications
Hệ thống nhắc đúng người đúng lúc qua cả in-app và email — giữ cho schedule-as-commitment model hoạt động mà không cần manager phải nhắc nhở thủ công.
**FRs covered:** FR38, FR39, FR40, FR41, FR42, FR43
**Technical notes:** Time-based triggers qua pg_cron (4 jobs đã define trong Architecture). Event-based triggers qua Supabase Edge Functions. Dual delivery: insert vào notifications table (in-app) + Resend API call (email). Cần batch sending cho multi-tenant scale.

### Epic 7: Incident Management
Manager có thể ghi nhận sự cố một cách chính thức, member có quyền giải thích và appeal — toàn bộ lịch sử được bảo vệ bởi immutable audit trail, đảm bảo tính fair cho cả hai phía.
**FRs covered:** FR44, FR45, FR46, FR47, FR48
**Technical notes:** Incidents và appeals là append-only inserts — không UPDATE, không DELETE bất cứ thứ gì. 4 loại incident category (từ PRD). Appeal outcome được log với timestamp. Manager chỉ log thủ công, system không tự động log.

---

## Epic 1: Foundation & Team Onboarding

Team có thể được setup đầy đủ và tất cả thành viên có thể truy cập hệ thống với đúng quyền của mình — từ project initialization cho đến member onboarding hoàn chỉnh.

### Story 1.1: Project Setup & Supabase Foundation

As a developer,
I want the TekSpace project initialized with complete database schema, RLS policies, and shared frontend foundation,
So that all parallel development agents can work independently without schema conflicts or setup blockers.

**Acceptance Criteria:**

**Given** SpeakPing-Admin codebase available làm base
**When** setup hoàn tất
**Then** project chạy được locally, kết nối Supabase thành công
**And** tất cả 13 migration files được tạo và apply (users, tenants, tenant_members, tenant_invites, schedule_weeks, schedule_slots, daily_reports, notifications, incidents, incident_appeals + RLS + custom_access_token_hook + pg_cron_jobs)
**And** RLS policies active trên tất cả data tables với `current_tenant_id()` helper
**And** Custom Access Token Hook được enable trong Supabase Auth → embed `tenant_roles: { tenantId: role }` vào JWT
**And** Extensions `pg_cron` và `pg_net` được enable
**And** `app.edge_function_url` và `app.service_role_key` được set trong DB settings
**And** 4 Edge Functions deployed (có thể là stubs): `remove-member`, `notify-schedule-change`, `send-invite`, `notify-schedule-reminder`
**And** tất cả shared frontend libs được tạo: `supabase-browser.ts`, `supabase-types.ts`, `query-client.ts`, `permissions.ts`, `routes.ts`, `query-keys.ts`, `auth-store.ts`, `tenant-store.ts`
**And** `src/routes/_app.tsx` (layout + auth guard) và `src/routes/sign-in.tsx` (placeholder) tồn tại
**And** SpeakPing-specific features đã được xóa, TekSpace feature folders đã được tạo
**And** schema tuân thủ đầy đủ Architecture document: `tenant_id` là cột thứ 2 trong mọi data table, primary key là `id uuid DEFAULT gen_random_uuid()`, timestamps là `created_at`/`updated_at`, naming conventions snake_case, RLS policy names theo pattern `{table}_{operation}_policy`

### Story 1.2: User Registration & Login

As a new user,
I want to register an account with email and password and log in securely,
So that I can access TekSpace with my personal account.

**Acceptance Criteria:**

**Given** user truy cập sign-in page và chọn "Tạo tài khoản"
**When** user điền email hợp lệ + password tối thiểu 8 ký tự + confirm password
**Then** tài khoản được tạo trong Supabase Auth
**And** user được redirect đến trang tạo tenant (nếu chưa có tenant) hoặc dashboard

**Given** user đã có tài khoản và nhập credentials hợp lệ
**When** user click "Đăng nhập"
**Then** session được tạo, user được redirect đến app
**And** session tự động expire sau 24 giờ inactive

**Given** user nhập sai email hoặc password
**When** user submit form
**Then** hiển thị error message cụ thể, không expose thông tin security
**And** tất cả traffic qua HTTPS, user input được validate và sanitize

### Story 1.3: Password Management

As a user,
I want to reset my forgotten password via email and change my password while logged in,
So that I can always regain and maintain secure access to my account.

**Acceptance Criteria:**

**Given** user ở sign-in page và click "Quên mật khẩu"
**When** user nhập email và submit
**Then** Resend gửi email reset password với link có thời hạn 1 giờ
**And** link chỉ dùng được một lần — sau khi dùng hoặc hết hạn, link bị vô hiệu hóa

**Given** user click reset link còn hiệu lực
**When** user nhập password mới (≥ 8 ký tự) và confirm
**Then** password được cập nhật, user được redirect đến sign-in

**Given** user click reset link đã hết hạn hoặc đã dùng
**When** page load
**Then** hiển thị: "Link đã hết hạn. Vui lòng yêu cầu reset password lại."

**Given** user đã đăng nhập và vào trang đổi password
**When** user nhập current password đúng + new password + confirm
**Then** password được cập nhật thành công, toast success
**And** nếu current password sai → error inline, password không đổi

### Story 1.4: Tenant Creation & Team Settings

As an Owner,
I want to create a new team workspace and configure its settings,
So that my team has a properly configured environment before members join.

**Acceptance Criteria:**

**Given** authenticated user chưa có tenant membership nào
**When** user điền team name và tạo tenant
**Then** tenant được tạo trong DB, user được gán role Owner trong tenant_members
**And** user được redirect đến team settings page để hoàn tất setup

**Given** Owner ở team settings page
**When** Owner cấu hình: schedule submission deadline, daily report deadline, default committed hours, team timezone
**Then** tất cả settings được lưu và apply ngay lập tức
**And** daily report deadline mặc định là 03:00 sáng ngày hôm sau theo team timezone

**Given** Owner thay đổi team timezone
**When** save settings
**Then** tất cả timestamp displays trong app reflect timezone mới, UTC storage không thay đổi

### Story 1.5: Member Invitation & Onboarding

As an Owner or Manager,
I want to invite people to join my team via email and have them onboard smoothly,
So that team members can quickly get set up and start using TekSpace.

**Acceptance Criteria:**

**Given** Owner/Manager ở members management page
**When** họ nhập email của người cần invite và gửi
**Then** Resend gửi invite email với link valid 48 giờ
**And** invite xuất hiện trong danh sách với status "pending"

**Given** người nhận click invite link còn hiệu lực và chưa có tài khoản
**When** họ hoàn tất registration
**Then** họ thấy màn hình "Accept & Join [Team Name]" explicit confirmation → join tenant với role Member → set timezone cá nhân → redirect đến schedule registration tuần hiện tại
**And** nếu member join giữa tuần: các ngày đã qua trong tuần hiện tại được hiển thị greyed out (read-only, không tạo slot được), member chỉ đăng ký lịch cho các ngày còn lại trong tuần

**Given** người nhận đã có tài khoản TekSpace
**When** họ click invite link
**Then** họ thấy màn hình "Accept & Join [Team Name]" — phải confirm dù đã authenticated
**And** sau khi accept, tenant mới xuất hiện trong tenant switcher của họ

**Given** invite link đã hết hạn (> 48 giờ)
**When** user click link
**Then** hiển thị: "Lời mời đã hết hạn. Vui lòng liên hệ manager để được invite lại."

### Story 1.6: Team Role & Membership Management

As an Owner,
I want to manage team membership and roles — including removing members, promoting roles, and transferring ownership,
So that the team structure always reflects current organizational reality.

**Acceptance Criteria:**

**Given** Owner/Manager ở members page và remove một member
**When** họ confirm remove action
**Then** Edge Function `remove-member` được gọi → `auth.admin.signOut(userId)` executed ngay lập tức
**And** member nhận toast notification thân thiện: "Bạn đã bị xóa khỏi [Team Name]."
**And** member status = `inactive` trong tenant_members, data được giữ nguyên
**And** action được log với actor + timestamp

**Given** Owner muốn promote Member lên Manager
**When** Owner confirm promotion
**Then** role được cập nhật trong tenant_members
**And** action được log với actor + timestamp

**Given** Owner muốn transfer ownership
**When** Owner chọn member và confirm transfer
**Then** Owner hiện tại trở thành Manager, member được chọn trở thành Owner
**And** action được log với actor + timestamp

**Given** Owner thử xóa tài khoản của mình và là sole Owner của bất kỳ tenant nào
**When** họ submit yêu cầu xóa tài khoản
**Then** hệ thống block và hiển thị: "Bạn cần transfer ownership hoặc xóa tenant trước khi xóa tài khoản."

**Given** Owner/Manager xem section Invitations
**When** page load
**Then** hiển thị danh sách tất cả invites với status (pending / accepted / expired)
**And** họ có thể resend invite cho bất kỳ invite nào (tạo invite link mới 48h)

### Story 1.7: Tenant Switcher & Personal Profile

As a user,
I want to see which team I'm in and switch between teams easily, and manage my personal timezone,
So that I always work in the right team context and see accurate local times.

**Acceptance Criteria:**

**Given** user ở bất kỳ trang nào trong app
**When** user nhìn vào header
**Then** tên tenant hiện tại luôn visible
**And** tenant switcher accessible trong ≤ 2 clicks

**Given** user là member của nhiều tenants
**When** user mở tenant switcher và chọn tenant khác
**Then** app reload với context của tenant mới (tenantId, role)
**And** tất cả data, permissions, và UI reflect đúng tenant đã chọn

**Given** user ở profile/settings page
**When** user chọn timezone từ searchable timezone list và save
**Then** timezone được lưu vào users.timezone
**And** tất cả timestamps trong app hiển thị theo timezone đã chọn

**Given** user bị remove khỏi tenant và session bị invalidated
**When** họ cố navigate hoặc thực hiện API call
**Then** họ được redirect đến sign-in với thông báo thân thiện

---

## Epic 2: Schedule Registration

Member có thể đăng ký lịch làm việc tuần, load template từ tuần trước để tiết kiệm thời gian, chỉnh sửa khi cần thiết — và hệ thống tự xử lý gracefully khi deadline bị bỏ lỡ.

### Story 2.1: Weekly Schedule Registration

As a member,
I want to register my work schedule for the upcoming week as time slots,
So that my manager knows when I'm available and I can commit to my working hours.

**Acceptance Criteria:**

**Given** member truy cập trang đăng ký lịch tuần
**When** member tạo một time slot (chọn ngày, start time, end time)
**Then** slot được lưu với `start_time (UTC) + duration_minutes`
**And** UI time picker có bước nhảy 30 phút (HH:00 hoặc HH:30)
**And** minimum slot duration là 30 phút, maximum là 12 giờ
**And** member có thể thêm nhiều slots trong cùng một ngày (VD: 9:00-11:30 và 14:00-17:00)

**Given** member tạo overnight slot (VD: 22:00 thứ Hai đến 02:00 thứ Ba)
**When** slot được save
**Then** slot thuộc về ngày bắt đầu (thứ Hai) cho mục đích dashboard và hours calculation
**And** hệ thống dùng UTC absolute time để kiểm tra overlap

**Given** member cố tạo 2 slots overlap nhau
**When** submit
**Then** hệ thống báo lỗi: "Thời gian này bị trùng với slot khác." — không cho phép lưu

**Given** member hoàn tất đăng ký lịch tuần
**When** submit schedule
**Then** lịch được lưu với trạng thái submitted, form respond < 1 giây

### Story 2.2: Schedule Template from Previous Week

As a member,
I want to load last week's schedule as a starting point for this week,
So that I can register my schedule faster when it's similar to the previous week.

**Acceptance Criteria:**

**Given** member mở trang đăng ký lịch tuần mới
**When** tuần trước member đã có lịch đăng ký
**Then** hệ thống tự động pre-fill lịch tuần trước làm template
**And** member có thể chỉnh sửa, xóa, hoặc thêm slots trước khi submit

**Given** member mở trang đăng ký lịch tuần mới
**When** tuần trước member chưa có lịch (hoặc lịch trống)
**Then** form hiển thị trống, không có pre-fill

**Given** template đã được load và member submit
**When** save
**Then** chỉ lưu slots cho tuần hiện tại — data tuần trước không bị thay đổi

### Story 2.3: Schedule Change & Deadline Lock

As a member,
I want to update my schedule when plans change, with the system requiring a reason and locking slots once they've started,
So that my manager is always informed and the schedule-as-commitment model is maintained.

**Acceptance Criteria:**

**Given** member muốn chỉnh sửa một slot đã đăng ký và slot chưa bị lock
**When** member edit slot
**Then** member phải nhập lý do thay đổi (bắt buộc, không được để trống)
**And** change được lưu, lý do được ghi vào schedule change history (append-only)
**And** Manager nhận in-app notification về sự thay đổi kèm lý do

**Given** current UTC time ≥ slot start_time (deadline lock)
**When** member cố edit hoặc xóa slot đó
**Then** slot bị lock, member thấy trạng thái "Đã khóa" và không thể edit bình thường

**Given** slot đã bị lock và member cần thay đổi khẩn cấp
**When** member chọn "Emergency Override" và nhập lý do bắt buộc
**Then** slot được phép chỉnh sửa
**And** lý do emergency override được ghi vào schedule change history
**And** Manager nhận notification về emergency override kèm lý do

### Story 2.4: Missed Deadline Auto-Handling

As a member,
I want the system to handle my missed schedule deadline without locking me out,
So that I can still update my schedule late and my manager is automatically notified.

**Acceptance Criteria:**

**Given** deadline đăng ký lịch đã qua và member chưa submit lịch
**When** pg_cron job `auto-create-empty-schedule` chạy
**Then** hệ thống tự động tạo lịch trống cho member trong tuần đó
**And** member nhận in-app notification: "Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."
**And** Manager nhận in-app notification: "[Member name] chưa đăng ký lịch tuần mới."

**Given** lịch trống đã được tạo sau deadline
**When** member mở trang đăng ký lịch
**Then** member thấy lịch trống và có thể điền lịch bình thường — không bị block, không mất quyền truy cập

**Given** member cập nhật lịch sau deadline
**When** member submit
**Then** lịch được lưu bình thường
**And** hệ thống KHÔNG tự động log incident — chỉ Manager mới log thủ công nếu muốn

---

## Epic 3: Team Visibility & Self-Dashboard

Manager thấy rõ cả team đang làm gì theo thời gian thực — và mỗi member tự theo dõi performance của mình, bao gồm so sánh ẩn danh với team average để tự điều chỉnh.

### Story 3.1: Team Overview Dashboard

As a Manager or Owner,
I want to see my team's weekly schedule at a glance,
So that I can know who is working when and plan task assignments accordingly.

**Acceptance Criteria:**

**Given** Manager/Owner truy cập Team Dashboard
**When** page load
**Then** hiển thị lịch làm việc tuần của tất cả active members dưới dạng grid hoặc list
**And** mỗi member hiển thị các slots đã đăng ký theo ngày trong tuần
**And** dashboard render < 2 giây với tối đa 15 members

**Given** Manager đang xem Team Dashboard
**When** Manager chọn một tuần khác (previous/next week)
**Then** lịch cập nhật hiển thị data của tuần được chọn

**Given** một member chưa đăng ký lịch cho tuần đang xem
**When** dashboard render
**Then** member đó hiển thị với lịch trống (không phải ẩn đi)

### Story 3.2: Real-time "Who is Online" & Timezone View

As a Manager or Owner,
I want to see who is currently working right now and view the team schedule in different timezones,
So that I can make informed decisions about who to assign tasks to at any moment.

**Acceptance Criteria:**

**Given** Manager mở Team Dashboard
**When** current UTC time nằm trong khoảng start_time và (start_time + duration_minutes) của một slot
**Then** member đó được hiển thị là "đang online" / trong giờ làm việc
**And** danh sách "đang online" được refresh tự động (refetchInterval — không dùng WebSocket cho MVP)

**Given** Manager muốn xem lịch theo timezone khác
**When** Manager chọn timezone từ timezone selector
**Then** tất cả time slots hiển thị theo timezone được chọn
**And** lựa chọn timezone này chỉ affect display, không thay đổi UTC data

**Given** không có member nào đang online
**When** dashboard render phần "Đang online"
**Then** hiển thị empty state: "Không có ai đang trong giờ làm việc."

### Story 3.3: Member Self-Dashboard

As a member,
I want to view my own schedule, hours, commitment rate, and see how I compare anonymously to the team,
So that I can self-assess and proactively adjust my effort without waiting for manager feedback.

**Acceptance Criteria:**

**Given** member truy cập Self-Dashboard
**When** page load
**Then** hiển thị lịch làm việc tuần hiện tại của chính member
**And** hiển thị total hours logged tuần này từ daily reports
**And** hiển thị commitment rate tuần này: (actual hours / committed hours) × 100%

**Given** member xem commitment rate
**When** actual hours < committed hours
**Then** commitment rate được hiển thị rõ ràng (VD: "22h / 35h = 63%")
**And** không có cảnh báo hay negative framing — chỉ hiển thị data trung thực

**Given** team có ít nhất 4 active members
**When** member xem phần so sánh ẩn danh
**Then** hiển thị team average commitment rate tuần này (aggregate query server-side)
**And** member thấy mình so với average nhưng KHÔNG biết số liệu cụ thể của ai
**And** individual member data không bao giờ được trả về trong response này

**Given** tenant có ít hơn 4 active members
**When** member xem Self-Dashboard
**Then** phần anonymous comparison bị ẩn hoàn toàn — không hiển thị partial data

---

## Epic 4: Daily Report

Member có thể submit báo cáo có cấu trúc hàng ngày với output type linh hoạt — và manager xem được toàn bộ output của team từ một nơi.

### Story 4.1: Submit Daily Report

As a member,
I want to submit a structured daily report with my completed tasks, hours worked, and work output links,
So that my manager can see what I accomplished without needing to ask.

**Acceptance Criteria:**

**Given** member mở trang Daily Report
**When** member điền form: danh sách tasks completed, total hours logged
**Then** member có thể thêm nhiều tasks, mỗi task có: task description, output type, output link (optional)

**Given** member chọn output type cho một task
**When** member click vào output type selector
**Then** các options hiển thị: PR (link GitHub/GitLab), Figma (link Figma), Document (link Google Doc/Notion/v.v.), Other (text)
**And** output link field thay đổi placeholder phù hợp với type được chọn

**Given** member đã điền đủ thông tin và submit report
**When** submit thành công
**Then** report được lưu với submitted_at timestamp
**And** report là append-only — không thể edit sau khi submit

**Given** member submit report sau daily report deadline (configurable, default 03:00 sáng ngày hôm sau)
**When** report được lưu
**Then** report được đánh dấu "late" trong DB
**And** "late" status visible với Manager, không block member khỏi submit

### Story 4.2: Cross-validation & Discrepancy Detection

As a member,
I want the system to flag potential discrepancies in my report before I submit,
So that I can catch mistakes and ensure my report accurately reflects my work.

**Acceptance Criteria:**

**Given** member nhập hours logged và task list
**When** `hours_logged > 4` AND số lượng tasks ≤ 1 AND không có output link nào
**Then** hệ thống hiển thị flag gợi ý: "Bạn báo cáo Xh nhưng số lượng tasks có vẻ ít — muốn thêm task không?"
**And** flag là suggestion — member có thể bỏ qua và submit bình thường

**Given** member thấy flag và muốn thêm task
**When** member click "Thêm task"
**Then** form cho phép thêm task vào report hiện tại trước khi submit

**Given** member quyết định bỏ qua flag
**When** member click "Submit anyway"
**Then** report được lưu bình thường với hours và tasks như đã điền

### Story 4.3: Manager Report View

As a Manager or Owner,
I want to view all team members' daily reports from one place,
So that I can track what everyone accomplished without asking individually.

**Acceptance Criteria:**

**Given** Manager truy cập Reports page
**When** page load
**Then** hiển thị danh sách reports của ngày hôm nay của tất cả active members
**And** Manager có thể filter theo ngày, member, hoặc status (submitted / missing / late)

**Given** Manager xem một report cụ thể
**When** Manager click vào report
**Then** hiển thị đầy đủ: tasks completed, hours logged, output links (clickable trực tiếp)
**And** Manager có thể click vào PR link, Figma link, v.v. mà không cần hỏi member

**Given** một member chưa submit report cho ngày đang xem
**When** Manager xem danh sách reports
**Then** member đó hiển thị với status "Chưa nộp" — không bị ẩn khỏi danh sách

---

## Epic 5: Hours Analytics

Manager có data khách quan để đánh giá commitment của từng thành viên theo thời gian — và member tự xem được lịch sử performance của mình để tự điều chỉnh trước khi bị nhắc.

### Story 5.1: Committed Hours Configuration

As a Manager or Owner,
I want to set committed hours targets for each team member,
So that the system can track and measure each person's commitment accurately.

**Acceptance Criteria:**

**Given** Manager/Owner ở member profile hoặc settings page
**When** họ set committed hours target cho một member (VD: 35h/tuần)
**Then** giá trị được lưu vào `tenant_members.committed_hours`
**And** thay đổi có hiệu lực ngay lập tức cho calculations từ tuần này

**Given** Manager set per-member committed hours khác với team default
**When** analytics calculate commitment rate của member đó
**Then** dùng per-member value, không dùng team default

**Given** committed hours chưa được set cho một member
**When** analytics calculate
**Then** dùng team default committed hours từ tenant settings

### Story 5.2: Team Hours Analytics Dashboard

As a Manager or Owner,
I want to see hours analytics for the whole team and drill down into individual members over time,
So that I have objective data for performance conversations instead of relying on gut feeling.

**Acceptance Criteria:**

**Given** Manager truy cập Analytics page
**When** page load
**Then** hiển thị team overview: danh sách members với committed hours, actual hours (tuần này), commitment rate (%)
**And** visual indicator rõ ràng cho members dưới threshold (VD: < 70%)

**Given** Manager muốn xem analytics theo thời gian của một member cụ thể
**When** Manager chọn member và time range (tuần / tháng)
**Then** hiển thị trend: committed vs actual hours theo từng tuần trong range đã chọn
**And** hiển thị average commitment rate trong period

**Given** Manager xem analytics
**When** data tính toán
**Then** actual hours được tính từ SUM của `daily_reports.hours_logged` trong period (bao gồm cả late reports)
**And** chỉ reports có status `submitted` mới được tính vào actual hours
**And** charts implement bằng Recharts (ShadcnUI chart component) — không dùng chart library khác
**And** analytics là read-only — không có write operations trên trang này

### Story 5.3: Member Self-Analytics History

As a member,
I want to view my own hours history and commitment rate trends over time,
So that I can self-assess my performance and proactively improve before the manager brings it up.

**Acceptance Criteria:**

**Given** member truy cập trang Self-Analytics (hoặc trong Self-Dashboard)
**When** page load
**Then** hiển thị lịch sử commitment rate theo từng tuần (ít nhất 4 tuần gần nhất)
**And** hiển thị actual hours vs committed hours theo từng tuần

**Given** member xem lịch sử của mình
**When** có tuần commitment rate thấp (VD: < 70%)
**Then** tuần đó được highlight để member dễ nhận ra — không có message phán xét
**And** member chỉ thấy data của chính mình, không thấy data cụ thể của người khác

---

## Epic 6: Smart Notifications

Hệ thống nhắc đúng người đúng lúc qua cả in-app và email — giữ cho schedule-as-commitment model hoạt động mà không cần manager phải nhắc nhở thủ công.

### Story 6.1: In-App Notification Center

As a user,
I want to see all my notifications in one place within the app,
So that I don't miss important alerts even if I don't check my email.

**Acceptance Criteria:**

**Given** user có notifications chưa đọc
**When** user nhìn vào header/nav
**Then** có badge/indicator hiển thị số notifications chưa đọc

**Given** user mở Notification Center
**When** page/panel load
**Then** hiển thị danh sách tất cả notifications theo thứ tự mới nhất trước
**And** mỗi notification có: message, timestamp (hiển thị theo user timezone), read/unread status

**Given** user click vào một notification
**When** notification được click
**Then** notification được đánh dấu là đã đọc
**And** user được navigate đến page liên quan theo mapping sau:
- Schedule reminder / missed deadline → `/schedule`
- Daily report reminder → `/daily-report`
- Schedule change (manager nhận) → `/schedule/manage`
- Incident logged (member nhận) → `/incidents`
- Appeal submitted (manager nhận) → `/incidents`
- Member removed → không navigate (session đã invalid, redirect về `/sign-in`)
- Invite notifications → không navigate (external email flow)

**Given** user muốn mark tất cả là đã đọc
**When** user click "Đánh dấu tất cả đã đọc"
**Then** tất cả notifications được cập nhật status = read

### Story 6.2: Schedule Deadline Notifications

As a member,
I want to be reminded before the schedule deadline and notified if I miss it,
So that I rarely forget to register my schedule and my manager is always informed.

**Acceptance Criteria:**

**Given** pg_cron job `remind-schedule-submission` chạy (Chủ nhật 8PM team timezone)
**When** member chưa submit lịch cho tuần tới
**Then** member nhận in-app notification: "Nhắc nhở: Hạn đăng ký lịch tuần tới là [deadline time]. Hãy đăng ký ngay!"
**And** Resend gửi email reminder cùng nội dung đến member

**Given** pg_cron job `deadline-missed-notify` chạy (sau deadline — Chủ nhật 11:59PM + 5 phút)
**When** member vẫn chưa submit lịch
**Then** member nhận in-app notification về việc bỏ lỡ deadline
**And** Manager nhận in-app notification: "[Member name] chưa đăng ký lịch tuần mới."
**And** cả hai đều nhận email notification qua Resend

**Given** member đã submit lịch trước deadline
**When** pg_cron job chạy
**Then** member đó KHÔNG nhận reminder hay missed notification

### Story 6.3: Daily Report Reminder

As a member,
I want to be reminded to submit my daily report each evening,
So that I don't forget to log my work and maintain the accountability loop.

**Acceptance Criteria:**

**Given** pg_cron job `remind-daily-report` chạy (tối hàng ngày theo team timezone — configurable)
**When** member chưa submit daily report cho ngày hôm nay
**Then** member nhận in-app notification: "Nhắc nhở: Bạn chưa nộp daily report hôm nay."
**And** Resend gửi email reminder đến member

**Given** member đã submit daily report cho ngày hôm nay
**When** pg_cron job chạy
**Then** member đó KHÔNG nhận reminder

**Given** cron job gặp lỗi khi chạy
**When** job fail
**Then** job có retry mechanism — thử lại theo configured retry policy

### Story 6.4: Event-Based Notifications

As a user,
I want to be instantly notified when important events happen — schedule changes, team changes — without delay,
So that I always have up-to-date information without needing to refresh.

**Acceptance Criteria:**

**Given** member thay đổi lịch đã đăng ký (có hoặc không có emergency override)
**When** change được save
**Then** Edge Function `notify-schedule-change` được gọi ngay lập tức
**And** Manager nhận in-app notification: "[Member name] vừa chỉnh slot [time]. Lý do: [reason]."
**And** Manager nhận email notification qua Resend với cùng thông tin

**Given** Owner/Manager remove một member khỏi tenant
**When** remove action được thực hiện
**Then** member nhận in-app notification thân thiện trước khi session bị invalidate
**And** nội dung: "Bạn đã được xóa khỏi [Team Name]. Cảm ơn bạn đã tham gia!"

**Given** Owner/Manager gửi invite cho member mới
**When** invite được tạo
**Then** Edge Function `send-invite` được gọi → Resend gửi invite email ngay lập tức
**And** email bao gồm: tên team, người invite, và invite link valid 48h

---

## Epic 7: Incident Management

Manager có thể ghi nhận sự cố một cách chính thức, member có quyền giải thích và appeal — toàn bộ lịch sử được bảo vệ bởi immutable audit trail, đảm bảo tính fair cho cả hai phía.

### Story 7.1: Log Incident

As a Manager or Owner,
I want to formally log incidents for team members with categories and notes,
So that there is an official, objective record of performance issues or policy violations.

**Acceptance Criteria:**

**Given** Manager/Owner ở member profile hoặc Incidents page
**When** Manager click "Log Incident" cho một member
**Then** hiển thị form: chọn category (4 loại: Late Schedule, Missed Report, Low Commitment, Policy Violation), nhập ghi chú (bắt buộc), confirm

**Given** Manager submit incident form
**When** submit thành công
**Then** incident được INSERT vào DB với: member_id, manager_id, category, note, created_at
**And** incident là immutable — không có UPDATE hay DELETE operation nào được phép
**And** member nhận in-app notification: "Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents."

**Given** Manager cố gắng edit hoặc delete một incident đã log
**When** họ thực hiện action đó
**Then** hệ thống không cho phép — không có edit/delete button nào tồn tại trong UI

### Story 7.2: Member Incident View & Appeal

As a member,
I want to view incidents logged against me and submit an appeal if I disagree,
So that I have a fair chance to provide my side of the story and the process is transparent.

**Acceptance Criteria:**

**Given** member truy cập trang Incidents của mình
**When** page load
**Then** hiển thị danh sách tất cả incidents được log cho member theo thứ tự mới nhất trước
**And** mỗi incident hiển thị: category, manager note, date, appeal status (pending / submitted / reviewed)

**Given** member muốn submit appeal cho một incident
**When** member click "Appeal" và nhập appeal response (bắt buộc)
**Then** appeal được INSERT vào DB với: incident_id, member_id, response, created_at
**And** appeal là append-only — member không thể edit appeal sau khi submit
**And** Manager nhận in-app notification: "[Member name] đã gửi appeal cho incident [date]."

**Given** member đã submit appeal cho một incident
**When** member xem incident đó
**Then** appeal response của member được hiển thị kèm theo incident
**And** member không thể submit thêm appeal cho cùng một incident

### Story 7.3: Incident History & Audit Trail

As a Manager or Owner,
I want to view the complete incident history for the whole team with full audit trail,
So that I have objective data for performance reviews and the system is accountable to everyone.

**Acceptance Criteria:**

**Given** Manager/Owner truy cập Incidents page (team view)
**When** page load
**Then** hiển thị tất cả incidents của cả team theo thứ tự mới nhất trước
**And** Manager có thể filter theo: member, category, date range, appeal status

**Given** Manager xem một incident cụ thể
**When** Manager click vào incident
**Then** hiển thị đầy đủ: incident details, member appeal (nếu có), timestamps của mọi action
**And** Manager có thể add outcome/response note — được INSERT như một record mới (không edit incident gốc)

**Given** bất kỳ action nào liên quan đến incidents (log, appeal, review note)
**When** action được thực hiện
**Then** action được lưu với actor_id và created_at timestamp
**And** không có record nào bị modify hay xóa — toàn bộ history là immutable append-only
