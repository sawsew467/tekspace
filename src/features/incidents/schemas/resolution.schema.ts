import { z } from 'zod'

export const RESOLUTION_OUTCOME_LABELS = {
  dismissed: 'Bỏ qua vi phạm',
  upheld:    'Giữ nguyên vi phạm',
} as const

export type ResolutionOutcome = keyof typeof RESOLUTION_OUTCOME_LABELS

export const RESOLUTION_OUTCOME_BADGE_VARIANT: Record<ResolutionOutcome, 'secondary' | 'destructive'> = {
  dismissed: 'secondary',
  upheld:    'destructive',
}

export const createResolutionSchema = z.object({
  outcome: z.enum(['dismissed', 'upheld'], {
    message: 'Vui lòng chọn kết quả xử lý',
  }),
  note: z
    .string()
    .max(2000, 'Ghi chú tối đa 2000 ký tự')
    .optional(),
})

export type CreateResolutionInput = z.infer<typeof createResolutionSchema>
