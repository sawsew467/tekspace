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
