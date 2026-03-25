import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'

/**
 * groupSlotsByUser — nhóm slots theo user_id.
 * Dùng trong TeamDashboard để map từng member → danh sách slots của họ.
 */
export function groupSlotsByUser(slots: ScheduleSlot[]): Record<string, ScheduleSlot[]> {
  return slots.reduce<Record<string, ScheduleSlot[]>>((acc, slot) => {
    if (!acc[slot.user_id]) acc[slot.user_id] = []
    acc[slot.user_id].push(slot)
    return acc
  }, {})
}

/**
 * getSlotsForDate — lọc slots có slot_date trùng với dateISO (YYYY-MM-DD).
 * slot_date đã được tính theo tenant timezone ở tầng DB → so sánh trực tiếp.
 */
export function getSlotsForDate(slots: ScheduleSlot[], dateISO: string): ScheduleSlot[] {
  return slots.filter(s => s.slot_date === dateISO)
}

/**
 * formatSlotTimeRange — format start/end time của slot theo displayTimezone.
 * Trả về string dạng "09:00 – 17:00".
 */
export function formatSlotTimeRange(slot: ScheduleSlot, displayTimezone: string): string {
  const startLocal = toZonedTime(new Date(slot.start_time), displayTimezone)
  const endMs = new Date(slot.start_time).getTime() + slot.duration_minutes * 60 * 1000
  const endLocal = toZonedTime(new Date(endMs), displayTimezone)
  return `${format(startLocal, 'HH:mm')} – ${format(endLocal, 'HH:mm')}`
}

/**
 * formatSlotDuration — format duration_minutes thành chuỗi dạng "8 giờ" hoặc "1 giờ 30 phút".
 */
export function formatSlotDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} phút`
  if (mins === 0) return `${hours} giờ`
  return `${hours} giờ ${mins} phút`
}

// ── Heatmap utilities ─────────────────────────────────────────────────────────

interface SlotLocalPart {
  day: string       // YYYY-MM-DD trong displayTimezone
  startD: number    // decimal hour, e.g. 9.5 = 09:30
  endD: number      // decimal hour, e.g. 17.0 = 17:00 (exclusive upper bound)
}

/**
 * computeSlotLocalParts — tính khoảng giờ local của một slot trong displayTimezone.
 *
 * Overnight slots (vượt qua midnight) được tách thành 2 phần:
 *   - Part 1: ngày bắt đầu, từ startHour → 24
 *   - Part 2: ngày kết thúc, từ 0 → endHour
 *
 * Overlap check: slot overlap giờ H ↔ part.startD < H+1 AND part.endD > H
 */
export function computeSlotLocalParts(slot: ScheduleSlot, displayTimezone: string): SlotLocalPart[] {
  const startUTC = new Date(slot.start_time)
  const endUTC = new Date(startUTC.getTime() + slot.duration_minutes * 60 * 1000)

  const startZoned = toZonedTime(startUTC, displayTimezone)
  const endZoned = toZonedTime(endUTC, displayTimezone)

  const startDay = format(startZoned, 'yyyy-MM-dd')
  const endDay = format(endZoned, 'yyyy-MM-dd')

  const startH = parseInt(format(startZoned, 'H'), 10)
  const startM = parseInt(format(startZoned, 'm'), 10)
  const endH = parseInt(format(endZoned, 'H'), 10)
  const endM = parseInt(format(endZoned, 'm'), 10)

  const startDecimal = startH + startM / 60
  const endDecimal = endH + endM / 60

  if (startDay === endDay) {
    return [{ day: startDay, startD: startDecimal, endD: endDecimal }]
  }

  // Overnight: split into ≤2 parts
  const parts: SlotLocalPart[] = [{ day: startDay, startD: startDecimal, endD: 24 }]
  if (endDecimal > 0) {
    parts.push({ day: endDay, startD: 0, endD: endDecimal })
  }
  return parts
}

/**
 * buildCellUserMap — precompute map: "YYYY-MM-DD:H" → userId[]
 *
 * Với mỗi slot, tính khoảng giờ local, rồi mark tất cả các ô (day, slot) bị overlap.
 * Step mặc định 0.5 = 30 phút, khớp với bội số 30 phút của schedule form.
 *
 * Key format: `${date}:${decimalHour}` — e.g. "2026-03-23:9" hoặc "2026-03-23:9.5"
 *
 * @param slots           Toàn bộ schedule_slots của tuần
 * @param displayTimezone IANA timezone của user đang xem
 * @param slotStart       Giờ bắt đầu hiển thị (inclusive decimal, default 8 = 08:00)
 * @param slotEnd         Giờ kết thúc hiển thị (exclusive decimal, default 20 = 20:00)
 * @param step            Kích thước bước (decimal, default 0.5 = 30 phút)
 */
export function buildCellUserMap(
  slots: ScheduleSlot[],
  displayTimezone: string,
  slotStart = 8,
  slotEnd = 20,
  step = 0.5,
): Map<string, string[]> {
  // Dùng Set<string> để dedup O(1) thay vì Array.includes O(n)
  const setMap = new Map<string, Set<string>>()

  for (const slot of slots) {
    const parts = computeSlotLocalParts(slot, displayTimezone)

    for (const part of parts) {
      for (let h = slotStart; h < slotEnd; h += step) {
        // Overlap: part.startD < h+step AND part.endD > h
        if (part.startD < h + step && part.endD > h) {
          const key = `${part.day}:${h}`
          if (!setMap.has(key)) setMap.set(key, new Set())
          setMap.get(key)!.add(slot.user_id)
        }
      }
    }
  }

  // Convert Set → string[] để giữ interface nhất quán với callers
  const result = new Map<string, string[]>()
  for (const [key, set] of setMap) {
    result.set(key, Array.from(set))
  }
  return result
}

/**
 * computeDisplayRange — tính khoảng [slotStart, slotEnd] để hiển thị heatmap.
 *
 * Logic:
 * - Nếu không có slots → default range [defaultStart, defaultEnd]
 * - Nếu có slots → mở rộng để cover tất cả slot local times (kể cả overnight parts)
 * - Snap xuống/lên 0.5 nearest boundary
 * - Clamp trong [0, 24]
 *
 * Ví dụ: slot 22:00–06:00 (overnight) → computeSlotLocalParts cho 2 parts:
 *   - {day: Mon, startD: 22, endD: 24} → slotStart ≤ 22, slotEnd ≥ 24
 *   - {day: Tue, startD: 0, endD: 6}  → slotStart ≤ 0, slotEnd ≥ 6
 *
 * Điều này tự động cover ca đêm mà không hard-code range.
 */
export function computeDisplayRange(
  slots: ScheduleSlot[],
  displayTimezone: string,
  defaultStart = 8,
  defaultEnd = 20,
): [number, number] {
  if (slots.length === 0) return [defaultStart, defaultEnd]

  let minStart = defaultStart
  let maxEnd = defaultEnd

  for (const slot of slots) {
    const parts = computeSlotLocalParts(slot, displayTimezone)
    for (const part of parts) {
      minStart = Math.min(minStart, part.startD)
      maxEnd = Math.max(maxEnd, part.endD)
    }
  }

  // Snap to 0.5 boundary, clamp [0, 24]
  const start = Math.max(0, Math.floor(minStart * 2) / 2)
  const end = Math.min(24, Math.ceil(maxEnd * 2) / 2)

  return [start, end]
}

/**
 * getHeatmapBgClass — Tailwind class cho nền ô dựa theo số members.
 */
export function getHeatmapBgClass(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'bg-blue-50 dark:bg-blue-950/60'
  if (count === 2) return 'bg-blue-100 dark:bg-blue-900/70'
  if (count === 3) return 'bg-blue-200 dark:bg-blue-800/80'
  return 'bg-blue-300 dark:bg-blue-700/90'
}

/**
 * getInitials — lấy 2 chữ cái đầu từ tên (pattern từ MemberList.tsx).
 * Guard: tên rỗng hoặc chỉ whitespace → trả về '?'
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return '?'
}

// ── Online status utilities ───────────────────────────────────────────────────

/**
 * getOnlineMemberIds — tính user_ids đang có slot active tại nowUTC.
 *
 * "Online" = now >= slot.start_time AND now < slot.start_time + duration_minutes
 * Pure UTC comparison — không cần timezone.
 * nowUTC injectable để test deterministic.
 *
 * Dedup: member có nhiều slots active cùng lúc → chỉ xuất hiện 1 lần.
 */
export function getOnlineMemberIds(slots: ScheduleSlot[], nowUTC?: Date): string[] {
  const nowMs = (nowUTC ?? new Date()).getTime()
  const onlineSet = new Set<string>()
  for (const slot of slots) {
    const startMs = new Date(slot.start_time).getTime()
    if (isNaN(startMs)) continue
    const endMs = startMs + slot.duration_minutes * 60_000
    if (nowMs >= startMs && nowMs < endMs) {
      onlineSet.add(slot.user_id)
    }
  }
  return Array.from(onlineSet)
}

// ── Self-Dashboard utilities (Story 3.3) ─────────────────────────────────────

/**
 * calcCommitmentRate — tính tỷ lệ actual / committed.
 * Trả về null nếu committedHours <= 0 (tránh chia 0).
 * Không giới hạn trên: member có thể vượt 100%.
 */
export function calcCommitmentRate(actualHours: number, committedHours: number): number | null {
  if (committedHours <= 0) return null
  return actualHours / committedHours
}

/**
 * formatCommitmentRate — format dạng "22h / 35h = 63%".
 * - actual được làm tròn và clamp >= 0 (guard data lỗi + hiển thị số nguyên).
 * - committed đã là số nguyên (smallint từ DB).
 * - Nếu committed = 0 → chỉ hiển thị "22h" (không negative framing).
 * - Math.round để tránh số lẻ (63.857... → 64%).
 */
export function formatCommitmentRate(actual: number, committed: number): string {
  const safeActual = Math.round(Math.max(0, actual)) // clamp + round (F8+F9)
  const rate = calcCommitmentRate(safeActual, committed)
  if (rate === null) return `${safeActual}h`
  return `${safeActual}h / ${committed}h = ${Math.round(rate * 100)}%`
}
