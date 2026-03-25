import { z } from 'zod'

export const createAppealSchema = z.object({
  response: z
    .string()
    .min(1, 'Nội dung phản hồi là bắt buộc')
    .max(2000, 'Phản hồi tối đa 2000 ký tự'),
})

export type CreateAppealInput = z.infer<typeof createAppealSchema>
