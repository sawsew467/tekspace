import type { ScheduleSlot } from '../services/schedule.service'

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
