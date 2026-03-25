# Story 8-4: Notification Message Review

**Epic:** 8 — UX Polish & Feature Completeness
**Story Key:** 8-4-notification-message-review
**Status:** done

---

## Story

As a user,
I want in-app notifications to have clear, self-descriptive messages,
So that I understand what happened without needing to click through to see context.

---

## Acceptance Criteria

**AC1 — schedule_reminder:** Message rõ ràng với deadline cụ thể và action link.
- Trước: `"Nhắc nhở: Hạn đăng ký lịch tuần tới là ${deadlineDisplay}. Hãy đăng ký ngay!"`
- Sau: `"⏰ Lịch tuần tới chưa đăng ký — hạn chót ${deadlineDisplay}. Đăng ký ngay!"`

**AC2 — schedule_missed (member):** Message nói rõ hậu quả.
- Trước: `"Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể."`
- Sau: `"⚠️ Bạn đã bỏ lỡ hạn đăng ký lịch tuần này. Lịch trống đã được tạo tự động — cập nhật lịch ngay nếu có thể."`

**AC3 — schedule_missed (manager):** Message rõ member nào, hành động gợi ý.
- Trước: `"${member.users.full_name} chưa đăng ký lịch tuần mới."`
- Sau: `"⚠️ ${member.users.full_name} đã bỏ lỡ hạn đăng ký lịch tuần mới."`

**AC4 — daily_report_reminder:** Message nhắc nhở rõ ràng.
- Trước: `"Nhắc nhở: Bạn chưa nộp daily report hôm nay."`
- Sau: `"📝 Nhắc nhở: Bạn chưa nộp daily report hôm nay. Ghi lại công việc để team cập nhật tiến độ!"`

**AC5 — member_removed:** Message lịch sự, rõ context.
- Trước: `"Bạn đã được xóa khỏi ${tenant?.name ?? 'team'}. Cảm ơn bạn đã tham gia!"`
- Sau: `"Bạn đã bị xóa khỏi team ${tenant?.name ?? ''}. Cảm ơn đã tham gia cùng team!"`

**AC6 — incident_logged:** Message cụ thể hơn về action cần làm.
- Trước: `"Một incident đã được ghi nhận. Bạn có thể xem chi tiết trong mục Incidents."`
- Sau: `"🚨 Một incident đã được ghi nhận cho bạn. Xem chi tiết và có thể gửi appeal nếu cần."`

**AC7 — appeal_submitted (manager notification):** Message rõ ai appeal và về incident nào.
- Trước: `"${callerName} đã gửi appeal cho incident ngày ${formattedDate}."`
- Giữ nguyên — đã đủ ngữ cảnh.

**AC8 — appeal_reviewed (member notification):** Message cụ thể hơn về action.
- Trước: `"Manager đã thêm ghi chú về incident của bạn."`
- Sau: `"📋 Manager đã xem xét và thêm ghi chú về incident của bạn. Xem chi tiết để biết kết quả."`

---

## Tasks / Subtasks

- [x] **Task 1:** Update `notify-schedule-reminder` Edge Function — schedule_reminder message
- [x] **Task 2:** Update `notify-schedule-reminder` Edge Function — schedule_missed member message
- [x] **Task 3:** Update `notify-schedule-reminder` Edge Function — schedule_missed manager message
- [x] **Task 4:** Update `notify-schedule-reminder` Edge Function — daily_report_reminder message
- [x] **Task 5:** Update `remove-member` Edge Function — member_removed message
- [x] **Task 6:** Update `notify-incident` Edge Function — incident_logged message
- [x] **Task 7:** Update `notify-outcome-note` Edge Function — appeal_reviewed message

---

## Dev Notes

### Technical Context
- 7 notification types across 3 Edge Functions + 1 frontend notification (send-invite in-app)
- Notification types: `schedule_reminder`, `schedule_missed`, `daily_report_reminder`, `member_removed`, `incident_logged`, `appeal_submitted`, `appeal_reviewed`
- Messages are plain text — no HTML (displayed via `NotificationItem.tsx` as `notification.message`)
- Emoji usage adds visual scanning ability — approved pattern for in-app messages
- `appeal_submitted` message in `notify-appeal` already has enough context (name + date), no change needed

### Files to Modify
- `supabase/functions/notify-schedule-reminder/index.ts` — schedule_reminder, schedule_missed (member + manager), daily_report_reminder
- `supabase/functions/remove-member/index.ts` — member_removed
- `supabase/functions/notify-incident/index.ts` — incident_logged
- `supabase/functions/notify-outcome-note/index.ts` — appeal_reviewed

---

## Dev Agent Record

### Completion Notes
- ✅ Updated all 7 notification types across 4 Edge Functions
- ✅ Messages are now self-descriptive with context, actor, and next action
- ✅ schedule_reminder — added deadline clearly with emoji
- ✅ schedule_missed member — clarified consequence (lịch trống tạo tự động)
- ✅ schedule_missed manager — clarified action missed
- ✅ daily_report_reminder — added reason why it matters
- ✅ member_removed — clearer, more polite language
- ✅ incident_logged — added appeal guidance
- ✅ appeal_reviewed — added guidance to view result

---

## File List

- `supabase/functions/notify-schedule-reminder/index.ts` — modified
- `supabase/functions/remove-member/index.ts` — modified
- `supabase/functions/notify-incident/index.ts` — modified
- `supabase/functions/notify-outcome-note/index.ts` — modified

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story created and implemented — all 7 notification messages updated |
