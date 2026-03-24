import { z } from 'zod'

// ── Output Type ──────────────────────────────────────────────────────────────

export const outputTypeSchema = z.enum(['pr', 'figma', 'document', 'other'])
export type OutputType = z.infer<typeof outputTypeSchema>

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  pr: 'PR (GitHub/GitLab)',
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

export const taskItemSchema = z.object({
  description: z.string().min(1, 'Mô tả task không được để trống'),
  output_type: outputTypeSchema,
  // '' passes, valid URL passes, non-URL non-empty string fails
  // union order: z.literal('') first để Zod không emit confusing union error
  output_link: z.union([z.literal(''), z.string().url('Link không hợp lệ')]).optional(),
})

export type TaskItem = z.infer<typeof taskItemSchema>

// ── Daily Report Form ────────────────────────────────────────────────────────

export const dailyReportFormSchema = z.object({
  tasks: z.array(taskItemSchema).min(1, 'Cần ít nhất 1 task'),
  hours_logged: z
    .number({ invalid_type_error: 'Vui lòng nhập số giờ' })
    .min(0, 'Số giờ không được âm')
    .max(24, 'Số giờ không được vượt quá 24')
    .multipleOf(0.5, 'Số giờ phải là bội số của 0.5 (VD: 0.5, 1, 1.5...)'),
})

export type DailyReportFormValues = z.infer<typeof dailyReportFormSchema>

// ── Discrepancy Detection ─────────────────────────────────────────────────────

/**
 * Phát hiện potential discrepancy: nhiều giờ nhưng ít task/output.
 * Pure function — không side effects, không async.
 * Condition: hours > 4 AND tasks ≤ 1 AND không có output_link nào.
 */
export function hasDiscrepancy(hoursLogged: number, tasks: TaskItem[]): boolean {
  const hasAnyOutputLink = tasks.some(t => t.output_link && t.output_link.trim() !== '')
  return hoursLogged > 4 && tasks.length <= 1 && !hasAnyOutputLink
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
