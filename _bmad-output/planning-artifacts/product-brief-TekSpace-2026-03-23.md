---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
date: 2026-03-23
author: Thắng
---

# Product Brief: TekSpace

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

TekSpace là một web app quản lý lịch làm việc dành cho các remote team — đặc biệt
phù hợp với team có thành viên là sinh viên với lịch học linh hoạt, không cố định.
App cho phép thành viên đăng ký nhiều khung giờ làm việc trong ngày theo tuần,
submit daily report có cấu trúc, và tự động tổng hợp giờ thực tế so với cam kết.
Manager có dashboard tổng quan để biết ai đang làm việc, ai rảnh để giao task,
và theo dõi accountability của cả team bằng data khách quan. Hệ thống hỗ trợ
đa timezone, kiến trúc multi-tenant ready, phù hợp cho cả team thuần Việt Nam lẫn
các team phân tán toàn cầu. UI được thiết kế laptop-first với mobile-friendly cho
các thao tác nhanh.

---

## Core Vision

### Problem Statement

Các remote team với thành viên là sinh viên gặp khó khăn nghiêm trọng trong việc
đồng bộ lịch làm việc. Thành viên có lịch học thay đổi theo tuần, làm việc theo
nhiều khung giờ rời rạc trong ngày, và có thể ở nhiều múi giờ khác nhau. Manager
không biết ai đang available để liên lạc hay giao việc, không nắm được giờ thực
tế làm việc so với cam kết, và thiếu data khách quan để đưa ra các quyết định
nhân sự như điều chỉnh commitment hay mức lương.

### Problem Impact

- Manager phải nhắn tin "mò" — thường xuyên nhận phản hồi "em đang đi học /
  đang làm nhóm"
- Không thể giao việc đúng lúc khi thành viên đang rảnh
- Không có cơ sở data để đánh giá mức độ cam kết thực tế dù thành viên
  đang nhận lương đầy đủ
- Các cuộc trò chuyện nhân sự khó xử vì thiếu data khách quan, chỉ dựa
  vào cảm nhận chủ quan
- Daily report làm thủ công trên chat, khó tổng hợp và phân tích theo thời gian
- Khi team mở rộng ra nhiều timezone, vấn đề coordination càng phức tạp hơn

### Why Existing Solutions Fall Short

- **Google Calendar / Calendly**: Không thiết kế cho team management, không có
  overview tổng hợp theo team, không tích hợp daily report hay hours tracking
- **Notion / spreadsheet**: Quá thủ công, không có notification, không có
  real-time visibility, không tự động tính giờ
- **HR tools truyền thống**: Thiết kế cho môi trường 9-5 cố định, không phù hợp
  với lịch học linh hoạt của sinh viên, thiếu hỗ trợ multi-timezone linh hoạt
- **Dùng nhiều tool riêng lẻ**: Phân mảnh hệ thống, team phải chuyển qua lại
  nhiều nơi, giảm adoption rate

### Proposed Solution

Một web app tập trung gồm các tính năng core:

**MVP (Phase 1):**

1. **Weekly Schedule Registration** — Thành viên đăng ký nhiều time slot trong
   ngày theo tuần (ví dụ: 9h-11h, 13h-17h, 20h-3h sáng) qua grid kéo thả
   trên desktop, time picker trên mobile. Có recurring template để tái sử dụng
   lịch tuần trước. Lưu UTC, hiển thị theo timezone cá nhân.

2. **Team Overview Dashboard** — Manager xem tổng quan lịch cả team dạng
   calendar/grid trên desktop. Mobile quick-view hiển thị ai đang online ngay
   lúc này. Hiển thị theo timezone của manager, toggle sang local time của
   từng member.

3. **Smart Notifications** — Thông báo khi thành viên bắt đầu ca làm việc,
   nhắc nhở điền lịch tuần mới, alert khi thành viên chưa đăng ký lịch.

4. **Structured Daily Report** — Form submit thay thế chat thủ công. Tích hợp
   PR link. Tự động cross-validate: nếu giờ log cao nhưng task ít/mơ hồ thì
   flag cảnh báo ngay khi submit. Tổng hợp giờ tự động từ lịch đã đăng ký.

5. **Hours Analytics** — So sánh giờ cam kết (committed hours) vs giờ thực tế
   từ lịch đăng ký và daily report. Manager dashboard xem toàn team.
   Self-visibility dashboard cho thành viên tự xem stats của mình kèm
   so sánh ẩn danh với team average.

**Phase 2:**

- Check-in / Check-out thực tế để đo giờ làm chính xác hơn
- AI tổng hợp và đánh giá daily report
- GitHub/GitLab integration (optional, cho team dùng tài khoản riêng)

### Key Differentiators

- **Multi-slot scheduling**: Hỗ trợ nhiều khung giờ rời rạc trong ngày — đúng
  với thực tế làm việc của sinh viên, không ép buộc giờ làm liên tục
- **Timezone-first architecture**: Lưu UTC, hiển thị local — hoạt động chính xác
  cho team đa quốc gia. Mobile hiển thị một timezone duy nhất để tránh confuse.
- **Data-driven accountability**: Hours analytics tạo ra data khách quan giúp
  manager đưa ra quyết định nhân sự dựa trên thực tế, không phải cảm nhận.
  Self-visibility dashboard giúp thành viên tự nhận ra và điều chỉnh.
- **Smart report validation**: Cross-validate daily report ngay lúc submit —
  cảnh báo inconsistency giữa giờ log và khối lượng công việc báo cáo.
- **All-in-one cho remote student team**: Schedule + daily report + hours tracking
  trong một hệ thống, tránh phân mảnh tool.
- **Multi-tenant ready**: Schema chuẩn từ ngày 1 (tenant_id), scale ra nhiều
  team/công ty khi cần mà không cần refactor.

---

## Target Users

### Primary Users

#### Persona 1 — Minh, Remote Team Manager

**Bối cảnh:**
Minh (28 tuổi) là developer với 4 năm kinh nghiệm, hiện đang kiêm vai trò
quản lý một remote team 5-8 người gồm chủ yếu là sinh viên. Đây là lần đầu
Minh làm quản lý — không qua đào tạo chính thức, học hỏi qua thực tế. Team
làm việc 100% remote, không có giờ cố định. Minh có thể là developer (tech)
hoặc non-tech manager (founder, PM) — app phục vụ cả hai.

**Vấn đề đang gặp:**
- Không biết ai đang làm việc ở khung giờ nào để liên lạc và giao task
- Nhắn tin thường xuyên nhận phản hồi "em đang bận" mà không có cơ sở
  để biết có đúng không
- Nghi ngờ một số thành viên không dành đủ thời gian cho team dù đang
  nhận lương, nhưng thiếu data để có cuộc trò chuyện khách quan
- Daily report đang nằm rải rác trong chat, khó tổng hợp và theo dõi trend

**Moment quan trọng nhất:**
Đo lường hiệu quả làm việc thực tế và giúp thành viên tự điều chỉnh
effort — không phải micro-manage, mà có data để lead bằng sự thật.

**Định nghĩa thành công:**
Minh mở dashboard buổi sáng, thấy ngay hôm nay ai làm việc khung giờ nào,
giao task cho người đang rảnh mà không cần nhắn hỏi trước. Cuối tháng nhìn
vào hours analytics của từng người — có data để nói chuyện thẳng thắn về
commitment mà không lo bị cho là chủ quan.

---

#### Persona 2 — Quỳnh, Student Developer (Team Member)

**Bối cảnh:**
Quỳnh (21 tuổi) là sinh viên năm 3 ngành CNTT, làm part-time cho một
startup remote. Lịch học thay đổi mỗi học kỳ, đôi khi có thêm lịch thi,
làm nhóm hoặc event trường. Thường làm việc ở nhà hoặc tranh thủ tại
trường khi có thời gian rảnh. Chủ yếu dùng laptop để code.

**Vấn đề đang gặp:**
- Lịch thay đổi liên tục, khó cam kết giờ cố định
- Đôi khi quên báo cáo hoặc báo cáo vội trên chat không đầy đủ
- Không biết mình đang được đánh giá như thế nào so với kỳ vọng manager
- Bị nhắn tin bất cứ lúc nào vì manager không biết lịch của mình

**Mối lo về tool mới:**
Nhiều thao tác, phiền phức → cần UX tối giản. Tuy nhiên vì đây là yêu
cầu từ manager và gắn với lương, adoption sẽ xảy ra nếu quy trình đủ
đơn giản.

**Giá trị thực sự với member:**
- Được đánh giá công bằng bằng data, không phải cảm tính của manager
- Tự thấy mình đứng ở đâu, tự điều chỉnh trước khi bị nhắc
- Ít bị làm phiền ngoài giờ đã đăng ký
- Có record công việc rõ ràng nếu có tranh cãi về hiệu suất

**Định nghĩa thành công:**
Quỳnh điền lịch tuần mới trong 2 phút từ template tuần trước, chỉ chỉnh
những ngày có lịch học khác. Submit daily report trong 3 phút. Nhìn vào
dashboard cá nhân thấy commitment rate của mình — tự điều chỉnh trước khi
manager cần nói gì.

---

### Secondary Users

#### Non-dev Team Members (Designer, Tester, PM)

Với các role không phải developer, schedule registration và hours tracking
hoàn toàn áp dụng được. Điểm khác biệt duy nhất là daily report: thay vì
PR link, output có thể là Figma link, issue tracker link, hay document link.
App cần hỗ trợ **flexible output type** trong daily report thay vì ép cứng
format dev.

---

### Product Positioning Note

TekSpace là **manager-centric tool** — được thiết kế từ góc nhìn người quản
lý, với đủ member value để đảm bảo adoption tự nguyện. Đây là positioning
có chủ đích, không phải hạn chế. Khi introduce app với team, nên framing:
*"Giúp anh không làm phiền em ngoài giờ đăng ký — đổi lại em cần đăng ký
lịch và report đầy đủ."*

---

### User Journeys

#### Journey — Quỳnh (Team Member) · Tuần làm việc điển hình

**Chủ nhật tối — Đăng ký lịch tuần mới (2 phút)**
```
Nhận notification nhắc đăng ký lịch
→ Mở app trên laptop
→ Template tuần trước tự load
→ Chỉnh ngày có lịch thi / bận đột xuất
→ Submit
```
*Aha moment: "Nhanh hơn mình nghĩ, tuần sau cũng vậy thôi."*

**Giữa tuần — Thay đổi lịch đột xuất**
```
Có việc bận đột xuất → Mở app → Chỉnh slot bị ảnh hưởng
→ Ghi lý do ngắn → Submit
→ Manager nhận notification thay đổi tự động
```
*Lưu ý: Không thể xóa slot trong vòng X giờ trước khi bắt đầu
(configurable). Emergency override có thể dùng nhưng phải ghi lý do.*

**Mỗi tối — Submit daily report (3 phút)**
```
Mở form report → Điền task + giờ + output link (PR/Figma/doc)
→ App cross-validate: "Bạn báo cáo 4h nhưng task có vẻ ít — muốn thêm không?"
→ Bổ sung hoặc giải thích → Submit
```
*Aha moment: "App nhắc mình điền đầy đủ hơn, không bị quên."*

**Cuối tuần — Xem self-dashboard**
```
Mở self-view → Thấy: tuần này log 22h / 35h cam kết (63%)
              Trung bình ẩn danh team: 78%
→ "Ít hơn mình nghĩ. Tuần sau cần sắp xếp tốt hơn."
```
*Aha moment: Tự điều chỉnh mà không cần ai nói.*

---

#### Journey — Minh (Manager) · Ngày làm việc điển hình

**Buổi sáng — Check team overview (1 phút)**
```
Mở dashboard → Thấy ngay: Quỳnh làm 9-11h, Phương làm 14-18h, Minh off
→ Giao task cho Quỳnh lúc 9h — không cần nhắn hỏi trước
```
*Aha moment: "Lần đầu tiên tôi biết chắc ai đang rảnh."*

**Giữa tuần — Nhận alert thay đổi lịch**
```
Notification: "Quỳnh vừa xóa slot 14h-17h hôm nay. Lý do: lịch thi đột xuất"
→ Không bị bất ngờ, không cần nhắn hỏi
```

**Cuối tháng — Review hours analytics**
```
Mở analytics:
  Quỳnh:   22h avg/tuần / 35h cam kết  → 63% commitment rate  ⚠️
  Phương:  33h avg/tuần / 35h cam kết  → 94% commitment rate  ✅
  Missed response: Quỳnh 4 lần, Phương 1 lần

→ Có data cụ thể để nói chuyện với Quỳnh về commitment
→ Cuộc trò chuyện dựa trên số liệu, không phải cảm nhận chủ quan
```
*Aha moment: "Tôi không cần đoán nữa — data nói thay tôi."*

---

### Known Limitations

- App giảm tỷ lệ nhắn sai giờ nhưng **không đảm bảo response** trong giờ đã đăng ký
- Lịch đăng ký phản ánh **kế hoạch**, không phải thực tế tuyệt đối
- Accountability cuối cùng vẫn phụ thuộc vào **văn hóa team và quy tắc rõ ràng** do manager đặt ra
- App là công cụ tạo evidence — leadership vẫn cần từ con người
- Communication vẫn qua Slack — TekSpace là *schedule visibility layer*,
  không thay thế công cụ giao tiếp hiện tại

---

## Success Metrics

### Định nghĩa thành công theo thời gian

| Mốc | Dấu hiệu thành công |
|---|---|
| **Tuần 1** | App chạy ổn định, toàn bộ team onboard và submit lịch tuần đầu tiên |
| **Tuần 2** | Manager thấy được team hoạt động đúng giờ, giao task không cần nhắn hỏi trước |
| **Tháng 1** | Đăng ký lịch + daily report thành thói quen, không cần nhắc nhở nhiều |
| **Tháng 3** | Thành viên tự điều chỉnh effort. Manager có đủ data cho ít nhất 1 quyết định nhân sự |

---

### User Success Metrics

#### Manager

| Metric | Mục tiêu |
|---|---|
| Giao task không cần nhắn hỏi trước | Đạt được từ tuần 2 |
| Số lần nhắn "mò" sai giờ | Giảm > 80% sau tháng 1 |
| Xác định thành viên ít effort bằng data | Rõ ràng sau tháng 1 |
| Có data cho cuộc trò chuyện nhân sự | Ít nhất 1 lần trong tháng 3 |

#### Team Member

| Metric | Mục tiêu |
|---|---|
| Tỷ lệ submit lịch đúng deadline | > 90% các tuần |
| Tỷ lệ submit daily report | > 85% các ngày làm việc |
| Tự xem self-dashboard | Ít nhất 1 lần/tuần |
| Tự cập nhật lịch khi có thay đổi | Không cần manager nhắc |

---

### Business Objectives

**Giai đoạn 1 — Internal validation (team Thắng):**
Validate app giải quyết được pain point thực tế trước khi mở rộng.
Thành công = team dùng ổn định sau 3 tháng, không có yêu cầu tắt app.

**Giai đoạn 2 — Multi-tenant:**
Mở rộng ra các remote team khác có cùng pain point, đặc biệt
startup/agency nhỏ dùng sinh viên part-time tại Việt Nam và quốc tế.

---

### Key Performance Indicators

#### Product Health (đo hàng tuần)

| KPI | Công thức | Target |
|---|---|---|
| Schedule Submission Rate | Member submit đúng hạn / tổng member | > 90% |
| Report Completion Rate | Report submitted / ngày làm việc | > 85% |
| Schedule Change Rate | Lần thay đổi giữa tuần / tổng slot | < 20% |
| Manager Dashboard Views | Số lần manager mở dashboard | Tăng dần — proxy cho adoption |

#### Behavior Change (đo hàng tháng)

| KPI | Ý nghĩa |
|---|---|
| Commitment Rate trung bình team | Giờ log / giờ cam kết — kỳ vọng tăng dần theo tháng |
| Incident Log count | Số incidents được log — kỳ vọng giảm dần khi team tự điều chỉnh |
| Appeal Rate | Số incidents được appeal / tổng incidents — đo tính fair của hệ thống |

#### Growth (khi multi-tenant)

| KPI | Target |
|---|---|
| Số team active | Tăng trưởng đều sau launch |
| 30-day retention | > 70% team tiếp tục dùng sau tháng 1 |
| 90-day retention | > 50% team tiếp tục dùng sau 3 tháng |

---

### North Star Metric

> **"Tỷ lệ thành viên tự điều chỉnh commitment rate tuần tiếp theo
> sau khi tuần trước dưới 70% — không cần manager nhắc nhở."**

Đây là dấu hiệu app đang tạo ra behavior change thực sự,
không chỉ là compliance tool.

---

### Incident Log System

Manager có thể ghi chú thủ công các sự việc đáng chú ý:

**Các loại incident:**
- Không phản hồi trong giờ làm đã đăng ký
- Không submit lịch đúng hạn
- Không submit daily report
- Khác *(ghi chú tự do)*

**Appeal system:**
- Member thấy được incidents của mình, không thể tự xóa
- Member có thể gửi giải thích/phản hồi cho manager
- Manager xem xét và quyết định giữ hoặc gỡ incident
- Toàn bộ lịch sử được lưu immutable — audit trail đầy đủ

*Nguyên tắc: Transparent với member từ đầu. Bảo vệ cả hai phía —
manager có căn cứ, member có quyền giải thích.*

---

## MVP Scope

### Core Features (MVP)

**Nhóm 1 — Auth & Foundation**
- Đăng ký, đăng nhập, phân quyền Manager / Member
- Multi-tenant ready: tenant_id trong toàn bộ schema từ ngày 1
- Timezone-first: lưu UTC, hiển thị theo timezone cá nhân

**Nhóm 2 — Schedule Management**
- Weekly Schedule Registration: multi-slot, grid kéo thả
  trên desktop, time picker trên mobile
- Recurring template: tái sử dụng lịch tuần trước
- Schedule Change Management: chỉnh giữa tuần, ghi lý do
  bắt buộc, notify manager tự động
- Deadline lock: không xóa slot trong X giờ trước khi bắt
  đầu (configurable), emergency override với lý do bắt buộc

**Nhóm 3 — Visibility & Dashboard**
- Team Overview Dashboard: manager xem lịch cả team theo
  tuần, hiển thị timezone manager, toggle local time member
- Mobile quick-view: ai đang online ngay lúc này
- Self-visibility Dashboard: member xem commitment rate,
  hours logged, so sánh ẩn danh với team average

**Nhóm 4 — Daily Report**
- Structured Daily Report: form thay thế chat thủ công
- Flexible output type: PR link / Figma link / doc link / khác
- Cross-validation: flag cảnh báo khi giờ log vs khối lượng
  task không khớp — hiển thị ngay lúc submit
- Option giải thích lý do khi report bị flag

**Nhóm 5 — Hours Analytics**
- Committed hours setting: mức giờ cam kết/tuần mỗi member
- Hours tracking: tự động tổng hợp từ lịch đăng ký
- Analytics dashboard: committed vs actual, trend theo tuần/tháng
- Manager view toàn team + member self-view

**Nhóm 6 — Notifications**
- Nhắc đăng ký lịch tuần mới (deadline configurable)
- Nhắc submit daily report
- Alert khi thành viên chưa đăng ký lịch
- Notify manager khi có thay đổi lịch giữa tuần

**Nhóm 7 — Incident Log**
- Manager log incident thủ công (4 loại + ghi chú tự do)
- Member thấy incidents của mình, không thể xóa
- Appeal system: member gửi giải thích, manager quyết định
- Audit trail immutable

---

### Out of Scope cho MVP

| Tính năng | Lý do dời sang sau |
|---|---|
| Check-in / Check-out | Cần thói quen dùng app trước — Phase 2 |
| AI report analysis | Cần data đủ lớn trước — Phase 2 |
| GitHub/GitLab integration | Phức tạp với private repo — Phase 2 |
| Multi-tenant UI | Schema ready nhưng chưa cần feature — Phase 2 |
| Task management | Slack đang làm tốt việc này, không thay thế |
| Messaging trong app | Slack đang làm tốt việc này, không thay thế |

---

### MVP Success Criteria

MVP được coi là thành công khi đạt tất cả các điều kiện sau
sau 4-6 tuần sử dụng thực tế:

- ✅ Toàn bộ team submit lịch đầy đủ ít nhất 3 tuần liên tiếp
- ✅ Manager giao task không cần nhắn hỏi trước ai đang rảnh
- ✅ Daily report submission rate > 85%
- ✅ Ít nhất 1 thành viên tự điều chỉnh commitment sau khi
     xem self-dashboard
- ✅ Manager có đủ data cho ít nhất 1 quyết định nhân sự
     có căn cứ

---

### Future Vision — 1-2 năm

**TekSpace → Lightweight HR Tool cho startup nhỏ**

Từ nền tảng schedule + accountability, mở rộng tự nhiên thành
công cụ quản lý nhân sự nhẹ cho startup/agency nhỏ (5-30 người)
không đủ nguồn lực dùng HR tool truyền thống.

**Phase 2 — Accountability deeper:**
- Check-in / Check-out thực tế
- AI tổng hợp và đánh giá chất lượng daily report
- GitHub/GitLab integration (optional)

**Phase 3 — HR lightweight:**
- Performance review đơn giản dựa trên data có sẵn
- Leave management: xin nghỉ, duyệt nghỉ, theo dõi
- Onboarding checklist cho member mới
- Export báo cáo nhân sự (PDF/Excel) cho cuối tháng

**Phase 4 — Platform:**
- Multi-tenant self-serve: công ty tự đăng ký, setup team
- Billing và subscription management
- API cho integration với Slack, Notion, Jira
