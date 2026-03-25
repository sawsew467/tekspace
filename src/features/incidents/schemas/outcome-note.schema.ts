import { z } from 'zod'

export const createOutcomeNoteSchema = z.object({
  note: z
    .string()
    .min(1, 'Ghi chú là bắt buộc')
    .max(2000, 'Ghi chú tối đa 2000 ký tự'),
})

export type CreateOutcomeNoteInput = z.infer<typeof createOutcomeNoteSchema>
