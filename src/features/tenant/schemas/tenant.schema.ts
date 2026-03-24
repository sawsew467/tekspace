import { z } from 'zod'

export const createTenantSchema = z.object({
  name: z
    .string()
    // F8: .trim() phải đứng TRƯỚC .min()/.max() để validate trên giá trị đã trim
    // Nếu để sau: "   " (3 spaces) pass min(2), trim thành "" → tên trắng vào DB
    .trim()
    .min(2, 'Tên nhóm tối thiểu 2 ký tự')
    .max(100, 'Tên nhóm tối đa 100 ký tự'),
})

export const teamSettingsSchema = z.object({
  timezone: z.string().min(1, 'Vui lòng chọn timezone'),
  // P-05: thêm custom error messages cho numeric fields
  schedule_deadline_day: z
    .number({ error: 'Vui lòng chọn ngày' })
    .int()
    .min(0, 'Ngày không hợp lệ')
    .max(6, 'Ngày không hợp lệ'),
  schedule_deadline_hour: z
    .number({ error: 'Vui lòng chọn giờ' })
    .int()
    .min(0, 'Giờ không hợp lệ')
    .max(23, 'Giờ không hợp lệ'),
  daily_report_deadline_hour: z
    .number({ error: 'Vui lòng chọn giờ' })
    .int()
    .min(0, 'Giờ không hợp lệ')
    .max(23, 'Giờ không hợp lệ'),
  // F10: onChange handler trong settings/team.tsx đã gọi Number() trước khi set,
  // nên dùng z.number() bình thường — không cần z.coerce
  default_committed_hours: z
    .number({ error: 'Vui lòng nhập số giờ' })
    .int('Số giờ phải là số nguyên')
    .min(1, 'Tối thiểu 1 giờ')
    .max(168, 'Tối đa 168 giờ'),
})

export const inviteMemberSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>
export type TeamSettingsInput = z.infer<typeof teamSettingsSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
