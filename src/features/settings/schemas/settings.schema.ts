import { z } from 'zod'
import { COMMON_TIMEZONES } from '@/lib/timezones'

const validTimezoneValues = COMMON_TIMEZONES.map((tz) => tz.value) as [string, ...string[]]

export const timezoneSchema = z.object({
  timezone: z.enum(validTimezoneValues, {
    error: 'Vui lòng chọn timezone hợp lệ',
  }),
})

export type TimezoneInput = z.infer<typeof timezoneSchema>
