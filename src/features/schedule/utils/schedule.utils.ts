import type { ScheduleSlot, SlotInput } from '../services/schedule.service'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

/**
 * shiftSlotsToCurrentWeek — shift toàn bộ slots từ tuần trước sang tuần hiện tại
 *
 * Logic:
 *   - start_time (timestamptz UTC) + 7 ngày (ms) → giờ đó ở tuần sau (đúng về UTC)
 *   - slot_date tái tính từ startTimeUTC shifted trong tenant timezone
 *     → tránh DST divergence: +7 ngày calendar ≠ +7 ngày UTC khi vượt DST boundary
 *     → đảm bảo DB trigger validate slot_date/start_time luôn pass
 *   - duration_minutes giữ nguyên
 */
export function shiftSlotsToCurrentWeek(
  previousSlots: ScheduleSlot[],
  tenantTimezone: string,
): SlotInput[] {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  return previousSlots.map(slot => {
    // Validate input — fail-fast với message rõ ràng thay vì im lặng tạo Invalid Date
    if (!slot.start_time || !slot.slot_date) {
      throw new Error(`Slot ${slot.id} thiếu start_time hoặc slot_date`)
    }
    const startMs = new Date(slot.start_time).getTime()
    if (isNaN(startMs)) {
      throw new Error(`Slot ${slot.id} có start_time không hợp lệ: ${slot.start_time}`)
    }

    // Shift +7 ngày trong UTC epoch
    const startTimeUTC = new Date(startMs + SEVEN_DAYS_MS)

    // Tái tính slot_date từ UTC shifted time trong tenant timezone
    // (giống convertSlotToUTC — DB trigger validate theo tenant timezone)
    const slotDate = format(toZonedTime(startTimeUTC, tenantTimezone), 'yyyy-MM-dd')

    return { slotDate, startTimeUTC, durationMinutes: slot.duration_minutes }
  })
}

/**
 * hasOverlapWithExisting — kiểm tra client-side xem slot mới có trùng với slot hiện có không
 *
 * Logic: OVERLAPS semantics — A overlaps B iff A.start < B.end AND A.end > B.start
 *
 * Sử dụng UTC epoch tuyệt đối để so sánh:
 *   - newStartUtc: thời gian bắt đầu đã convert sang UTC (từ convertSlotToUTC)
 *   - slot.start_time: UTC từ DB
 * → Xử lý đúng cả overnight slots và mọi timezone, không cần filter theo slot_date.
 *
 * DB trigger `check_slot_overlap` sẽ enforce server-side.
 */
export function hasOverlapWithExisting(
  newStartUtc: Date,          // UTC start time (từ convertSlotToUTC)
  durationMinutes: number,    // thời lượng tính bằng phút
  existingSlots: ScheduleSlot[],
  excludeSlotId?: string
): boolean {
  const newStartMs = newStartUtc.getTime()
  const newEndMs = newStartMs + durationMinutes * 60 * 1000

  return existingSlots.some((slot) => {
    if (excludeSlotId && slot.id === excludeSlotId) return false

    const existStart = new Date(slot.start_time).getTime()
    const existEnd = existStart + slot.duration_minutes * 60 * 1000

    // OVERLAPS: A overlaps B iff A.start < B.end AND A.end > B.start
    return newStartMs < existEnd && newEndMs > existStart
  })
}
