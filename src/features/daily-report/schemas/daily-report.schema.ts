import { z } from 'zod'
import { fromZonedTime } from 'date-fns-tz'
import { isBefore } from 'date-fns'

// ── Output Type ──────────────────────────────────────────────────────────────

export const outputTypeSchema = z.enum(['pr', 'figma', 'document', 'other'])
export type OutputType = z.infer<typeof outputTypeSchema>

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  pr: 'PR / MR',
  figma: 'Figma',
  document: 'Document',
  other: 'Other',
}

export const OUTPUT_TYPE_PLACEHOLDERS: Record<OutputType, string> = {
  pr: 'https://github.com/org/repo/pull/123',
  figma: 'https://figma.com/file/...',
  document: 'https://docs.google.com/... hoặc Notion link',
  other: 'Mô tả output (optional)',
}

// ── Task Item ────────────────────────────────────────────────────────────────
// Base schema dùng cho đọc từ report_tasks table (relational, Story 9.2).
// task_type có default 'completed' — backward compat khi parse rows cũ không có field này.

export const taskItemSchema = z.object({
  task_type: z.enum(['completed', 'in_progress']).default('completed'),
  project_tag: z.string().optional(),
  description: z.string().min(1, 'Mô tả task không được để trống'),
  output_type: outputTypeSchema,
  // '' passes, valid URL passes, non-URL non-empty string fails
  // union order: z.literal('') first để Zod không emit confusing union error
  output_link: z.union([z.literal(''), z.string().url('Link không hợp lệ')]).optional(),
  // Per-task hours (Story 4.5) — optional ở đây để backward compat với old reports trong DB.
  // Dùng taskItemFormSchema (required) cho form submission mới.
  hours: z
    .number()
    .min(0, 'Số giờ không được âm')
    .max(24, 'Tối đa 24h')
    .multipleOf(0.5, 'Bội số 0.5')
    .optional(),
})

export type TaskItem = z.infer<typeof taskItemSchema>

// ── Task Item Form Schema (Section 1 — hours required) ───────────────────────
// Dùng riêng cho form submission Section 1 (completed tasks) — extend taskItemSchema, require hours.

export const taskItemFormSchema = taskItemSchema.extend({
  hours: z
    .number({ error: 'Bắt buộc' })
    .min(0.5, 'Tối thiểu 0.5h')
    .max(24, 'Tối đa 24h')
    .multipleOf(0.5, 'Bội số 0.5'),
})

export type TaskFormItem = z.infer<typeof taskItemFormSchema>

// ── In Progress Task Form Schema (Section 2 — có hours bắt buộc, không có output) ──────────
// Dùng cho Section 2 "In Progress / Ongoing" trong form submission.
// hours bắt buộc để tính đủ năng suất ngày — không cần output_type/output_link vì task chưa xong.

export const inProgressTaskFormSchema = z.object({
  task_type: z.literal('in_progress').default('in_progress'),
  project_tag: z.string().optional(),
  description: z.string().min(1, 'Mô tả task không được để trống'),
  hours: z
    .number({ error: 'Bắt buộc' })
    .min(0.5, 'Tối thiểu 0.5h')
    .max(24, 'Tối đa 24h')
    .multipleOf(0.5, 'Bội số 0.5'),
})

export type InProgressTaskFormItem = z.infer<typeof inProgressTaskFormSchema>

// ── Daily Report Form ────────────────────────────────────────────────────────

export const dailyReportFormSchema = z.object({
  // Section 1: Tasks Completed Today (required, min 1)
  tasks: z.array(taskItemFormSchema).min(1, 'Cần ít nhất 1 task'),
  // Section 2: In Progress / Ongoing (optional, default empty)
  in_progress_tasks: z.array(inProgressTaskFormSchema).optional().default([]),
  // Section 3: Plan for Tomorrow (optional free text)
  plan_for_tomorrow: z.string().optional(),
  // Section 4: Blockers / Issues (optional free text)
  blockers: z.string().optional(),
  hours_logged: z
    .number({ error: 'Vui lòng nhập số giờ' })
    .min(0, 'Số giờ không được âm')
    .multipleOf(0.5, 'Số giờ phải là bội số của 0.5 (VD: 0.5, 1, 1.5...)'),
})

export type DailyReportFormValues = z.infer<typeof dailyReportFormSchema>

// ── Discrepancy Detection ─────────────────────────────────────────────────────

/**
 * Phát hiện potential discrepancy: nhiều giờ nhưng ít task/output.
 * Pure function — không side effects, không async.
 *
 * Story 4.5: Nếu TẤT CẢ tasks đều có hours > 0 → user đã tracking đủ chi tiết
 * → không cần cảnh báo discrepancy (hours đã là proof of work rõ ràng).
 * Fallback về hoursLogged chỉ khi không có per-task hours.
 *
 * Condition (fallback only): hoursLogged > 4 AND tasks ≤ 1 AND không có output_link nào.
 */
export function hasDiscrepancy(hoursLogged: number, tasks: TaskItem[]): boolean {
  // Khi đã có per-task hours đầy đủ → hours đã được tracking granular, không cần flag
  const allHasTaskHours = tasks.length > 0 && tasks.every(t => t.hours !== undefined && t.hours > 0)
  if (allHasTaskHours) return false

  // Fallback: dùng hoursLogged khi không có per-task hours
  const hasAnyOutputLink = tasks.some(t => t.output_link && t.output_link.trim() !== '')
  return hoursLogged > 4 && tasks.length <= 1 && !hasAnyOutputLink
}

// ── Edit Window ───────────────────────────────────────────────────────────────

/**
 * Kiểm tra xem report có còn trong edit window không.
 * Window = reportDate ngày tiếp theo, giờ deadlineHour, theo tenantTimezone.
 *
 * Ví dụ: report_date = '2026-03-25', deadlineHour = 3, TZ = 'Asia/Ho_Chi_Minh'
 * → deadline = 2026-03-26 03:00:00 ICT = 2026-03-25 20:00:00 UTC
 * → nếu now < deadline → còn window → true
 *
 * @param reportDate - ISO date string 'yyyy-MM-dd' của report
 * @param deadlineHour - giờ deadline (0-23) theo tenant timezone
 * @param tenantTimezone - IANA timezone string (VD: 'Asia/Ho_Chi_Minh')
 * @param now - thời điểm so sánh (mặc định = new Date()); injectable để test và real-time check
 * @returns true nếu now < deadline; false nếu hết window hoặc timezone invalid
 */
export function isWithinEditWindow(
  reportDate: string,
  deadlineHour: number,
  tenantTimezone: string,
  now: Date = new Date(),
): boolean {
  // Guard empty timezone — fromZonedTime fallback về UTC với empty string, không throw
  if (!tenantTimezone || tenantTimezone.trim() === '') return false
  try {
    // Parse components trực tiếp từ 'yyyy-MM-dd' để tránh parseISO local-timezone behavior.
    // parseISO('yyyy-MM-dd') trả về local midnight (không phải UTC midnight), gây sai ngày
    // khi server/browser ở timezone khác tenant. Dùng Date.UTC để luôn tính theo UTC.
    const parts = reportDate.split('-').map(Number)
    if (parts.length !== 3 || parts.some(v => isNaN(v))) return false
    const [y, m, d] = parts
    // Date.UTC tự xử lý rollover (ví dụ: d=31 + 1 → tháng tiếp theo)
    const nextDayStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    // Construct deadline trong tenant timezone rồi convert về UTC để so sánh với now
    const deadlineUTC = fromZonedTime(
      `${nextDayStr}T${String(deadlineHour).padStart(2, '0')}:00:00`,
      tenantTimezone,
    )
    return isBefore(now, deadlineUTC)
  } catch {
    // Timezone invalid hoặc date parse error → không cho edit (safe default)
    return false
  }
}

// ── Streak Computation ────────────────────────────────────────────────────────

/**
 * Chuyển dateStr 'yyyy-MM-dd' về ngày hôm trước dùng local Date constructor
 * (tránh UTC offset bug của toISOString). Trả về null nếu dateStr không hợp lệ.
 */
function prevDateStr(dateStr: string): string | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(v => isNaN(v))) return null
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d) // local date constructor
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Kiểm tra dateStr 'yyyy-MM-dd' có phải T7 (Saturday) hoặc CN (Sunday) không.
 */
function isWeekend(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(v => isNaN(v))) return false
  const [y, m, d] = parts
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

/**
 * Tính số ngày nộp report liên tiếp tính từ today trở về.
 * Pure function — không side effects, không async.
 *
 * Quy tắc:
 * - Streak bắt đầu chỉ khi hôm nay (today) đã có submission.
 * - T7/CN không nộp → bỏ qua (không phá streak, không tính vào streak).
 * - T7/CN có nộp → tính vào streak bình thường.
 * - Ngày thường (T2–T6) không nộp → dừng streak.
 *
 * @param reportDates - mảng các report_date strings (ISO yyyy-MM-dd)
 * @param today - ngày hôm nay (yyyy-MM-dd, theo timezone của user)
 * @returns số ngày streak; 0 nếu hôm nay chưa nộp
 */
export function computeStreak(reportDates: string[], today: string): number {
  const dateSet = new Set(reportDates)

  // Streak chỉ đếm khi hôm nay đã nộp
  if (!dateSet.has(today)) return 0

  let streak = 0
  let current: string | null = today
  // Safety cap: không thể streak nhiều hơn số ngày đã nộp × 2 + 14 (buffer cho 2 tuần weekends)
  const maxIterations = dateSet.size * 2 + 14

  for (let i = 0; i < maxIterations; i++) {
    if (!current) break

    if (dateSet.has(current)) {
      // Ngày này đã nộp → tính vào streak
      streak++
    } else if (isWeekend(current)) {
      // T7/CN không nộp → bỏ qua, không phá streak
    } else {
      // Ngày thường không nộp → dừng
      break
    }

    current = prevDateStr(current)
  }

  return streak
}
