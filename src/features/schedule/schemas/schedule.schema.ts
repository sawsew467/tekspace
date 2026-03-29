import { z } from 'zod'

// ── Zod schema cho một time slot trong form (input từ user) ──────────────────

/** Parse endTime string → minutes-in-day. "24:00" → 1440, otherwise HH:MM → h*60+m */
function parseEndMins(endTime: string): number {
  if (endTime === '24:00') return 24 * 60
  const [h, m] = endTime.split(':').map(Number)
  return h * 60 + m
}

export const slotFormSchema = z
  .object({
    // ISO date string "YYYY-MM-DD" — ngày của slot trong tuần được đăng ký
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
    // "HH:MM" 24h — giờ bắt đầu, bội số 30 phút (00 hoặc 30)
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu không hợp lệ')
      .refine(
        (t) => {
          const [, mm] = t.split(':').map(Number)
          return mm === 0 || mm === 30
        },
        { message: 'Giờ bắt đầu phải là bội số 30 phút (VD: 09:00, 09:30)' }
      ),
    // "HH:MM" 24h — giờ kết thúc, bội số 30 phút (bao gồm 24:00)
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc không hợp lệ')
      .refine(
        (t) => {
          if (t === '24:00') return true
          const [, mm] = t.split(':').map(Number)
          return mm === 0 || mm === 30
        },
        { message: 'Giờ kết thúc phải là bội số 30 phút (VD: 10:00, 10:30, 24:00)' }
      ),
  })
  .refine(
    (data) => {
      const [sh, sm] = data.startTime.split(':').map(Number)
      const startMins = sh * 60 + sm
      const endMins = parseEndMins(data.endTime)

      // endTime must be strictly greater than startTime
      if (endMins <= startMins) return false

      const durationMins = endMins - startMins
      return durationMins >= 30 && durationMins <= 720
    },
    {
      message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu. Hoặc chọn ngày tiếp theo.',
      path: ['endTime'],
    }
  )

export type SlotFormValues = z.infer<typeof slotFormSchema>

// ── Schema cho submit toàn bộ lịch tuần ────────────────────────────────────

export const scheduleSubmitSchema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'week_of không hợp lệ'),
  slots: z.array(slotFormSchema),
})

export type ScheduleSubmitValues = z.infer<typeof scheduleSubmitSchema>

// ── Helper: tính duration_minutes từ startTime + endTime ─────────────────────

export function calcDurationMinutes(values: Pick<SlotFormValues, 'startTime' | 'endTime'>): number {
  const [sh, sm] = values.startTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = parseEndMins(values.endTime)
  return endMins - startMins
}

// ── Helper: format duration thân thiện ("2 giờ 30 phút") ───────────────────

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} phút`
  if (m === 0) return `${h} giờ`
  return `${h} giờ ${m} phút`
}
