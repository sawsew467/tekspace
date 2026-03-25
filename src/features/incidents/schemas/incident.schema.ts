import { z } from 'zod'
import type { Enums } from '@/lib/supabase-types'

export type IncidentCategory = Enums<'incident_category'>

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  late_schedule:    'Đăng ký lịch trễ',
  missed_report:    'Bỏ lỡ Daily Report',
  low_commitment:   'Cam kết giờ thấp',
  policy_violation: 'Vi phạm quy định',
}

export const CATEGORY_BADGE_VARIANT: Record<IncidentCategory, 'destructive' | 'secondary' | 'outline'> = {
  policy_violation: 'destructive',
  late_schedule:    'secondary',
  missed_report:    'secondary',
  low_commitment:   'outline',
}

export const createIncidentSchema = z.object({
  memberId: z.string().uuid('Vui lòng chọn thành viên'),
  category: z.enum(
    ['late_schedule', 'missed_report', 'low_commitment', 'policy_violation'] as const,
    {
      // errorMap phủ tất cả lỗi (required, invalid_type, invalid_enum_value)
      errorMap: () => ({ message: 'Vui lòng chọn loại incident' }),
    }
  ),
  note: z
    .string()
    .min(1, 'Ghi chú là bắt buộc')
    .max(2000, 'Ghi chú tối đa 2000 ký tự'),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
