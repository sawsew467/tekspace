import type { ScheduleSlot, SlotInput } from '../services/schedule.service'
import { addDays, format, parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'

/**
 * SlotEditMode — 4-tier lock model (Story 2.5 + Story 9.7)
 *
 * | Tầng           | Điều kiện                                      | Hành vi                                  |
 * |----------------|------------------------------------------------|------------------------------------------|
 * | locked         | slot_date < today                              | Card grayed out, no edit/delete          |
 * | started        | slot_date = today AND start_time < now()       | Emergency Override dialog + RPC          |
 * | reason-required| slot_date = today (start_time >= now()) hoặc   | Edit/delete → reason dialog + RPC        |
 * |                | slot_date trong tuần này (đến CN)              |                                          |
 * | free           | slot_date >= next_monday                       | Edit/delete → direct call, no notify     |
 */
export type SlotEditMode = 'locked' | 'started' | 'reason-required' | 'free'

/**
 * getSlotEditMode — xác định edit mode của slot dựa theo slot_date và start_time so với thời điểm hiện tại
 *
 * @param slotDate     "YYYY-MM-DD" — slot_date từ DB
 * @param startTime    ISO timestamp UTC — slot.start_time từ DB (e.g. "2026-03-25T18:30:00+00:00")
 * @param userTimezone IANA timezone của user (e.g. "Asia/Ho_Chi_Minh")
 */
export function getSlotEditMode(
  slotDate: string,
  startTime: string,
  userTimezone: string,
): SlotEditMode {
  const now = new Date()
  const todayInUserTz = format(
    toZonedTime(now, userTimezone),
    'yyyy-MM-dd',
  )
  // parseISO parses "YYYY-MM-DD" as local midnight — getDay() trả đúng weekday
  // trong mọi browser timezone (new Date("YYYY-MM-DD") lại parse UTC → getDay() sai)
  const todayDate = parseISO(todayInUserTz)

  // Next Monday = start of next week
  const dayOfWeek = todayDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMondayISO = format(
    addDays(todayDate, daysUntilMonday),
    'yyyy-MM-dd',
  )

  if (slotDate < todayInUserTz) return 'locked'                                               // Tầng 1: quá khứ
  if (slotDate === todayInUserTz && startTime && new Date(startTime) < now) return 'started'  // Tầng 2a: hôm nay, đã bắt đầu
  if (slotDate < nextMondayISO) return 'reason-required'                           // Tầng 2b: tuần này
  return 'free'                                                                    // Tầng 3: tuần sau+
}

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
 * formatSlotTime — format time range từ UTC start_time + durationMinutes trong user timezone
 * Di chuyển từ ScheduleGrid.tsx để tái sử dụng trong TimeGrid.tsx
 */
export function formatSlotTime(startTime: string, durationMinutes: number, timezone: string): string {
  const start = toZonedTime(new Date(startTime), timezone)
  const endMs = new Date(startTime).getTime() + durationMinutes * 60 * 1000
  const end = toZonedTime(new Date(endMs), timezone)
  return `${formatTz(start, 'HH:mm', { timeZone: timezone })} → ${formatTz(end, 'HH:mm', { timeZone: timezone })}`
}

/**
 * formatSlotDuration — format duration phút → human-readable string (VD: "2h30p", "1 giờ", "45p")
 * Di chuyển từ ScheduleGrid.tsx để tái sử dụng trong TimeGrid.tsx
 */
export function formatSlotDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}p`
  if (m === 0) return `${h} giờ`
  return `${h}h${m}p`
}

/**
 * minutesToTimeString — convert minutes-from-midnight → 'HH:mm'
 * Input: any integer. Uses true modulo to handle negative values safely
 * (JS % is remainder, not modulo: -1 % 1440 = -1, not 1439).
 */
export function minutesToTimeString(minutes: number): string {
  const DAY = 24 * 60
  // True modulo: always non-negative
  const totalMins = ((minutes % DAY) + DAY) % DAY
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * snapTo30 — snap minutes to nearest 30-minute boundary
 * snap(45) = 60 (rounds up at 15-min mark), snap(14) = 0, snap(15) = 30
 */
export function snapTo30(minutes: number): number {
  return Math.round(minutes / 30) * 30
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
