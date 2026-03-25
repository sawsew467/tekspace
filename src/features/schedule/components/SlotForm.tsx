import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { slotFormSchema, type SlotFormValues, calcDurationMinutes, formatDuration } from '../schemas/schedule.schema'
import { hasOverlapWithExisting } from '../utils/schedule.utils'
import { convertSlotToUTC, type ScheduleSlot } from '../services/schedule.service'

// ── Time options (00:00–23:30, bước 30 phút) ─────────────────────────────────

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

// Overnight end time options: chỉ 00:00 → 06:00 (AC9), không bao gồm 06:30+
const OVERNIGHT_END_OPTIONS = TIME_OPTIONS.filter((t) => {
  const [h, m] = t.split(':').map(Number)
  return h < 6 || (h === 6 && m === 0) // 00:00, 00:30, ..., 06:00
})

// ── Props ─────────────────────────────────────────────────────────────────────

interface SlotFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekOf: string                 // Monday ISO date "YYYY-MM-DD"
  defaultDate?: string           // AC3: "YYYY-MM-DD" — pre-fill dropdown Ngày khi click "+"
  defaultStartTime?: string      // 'HH:mm', 30-min aligned — từ drag-to-create (AC8)
  defaultEndTime?: string        // 'HH:mm', 30-min aligned — từ drag-to-create (AC8)
  existingSlots: ScheduleSlot[]
  onSubmit: (values: SlotFormValues) => void
  isLoading?: boolean
  userTimezone: string           // IANA timezone của user (để convert UTC cho overlap check)
  tenantTimezone: string         // IANA timezone của tenant (để tính slot_date)
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SlotForm — dialog để thêm một time slot mới vào lịch tuần
 *
 * Features:
 * - Chọn ngày trong tuần (Mon–Sun) của week_of, pre-fill từ defaultDate (AC3)
 * - Chọn start time và end time (30-min steps)
 * - Overnight support: auto-detect khi endTime <= startTime
 *   - Overnight end time được cap tại 06:00 (AC9)
 * - Hint text khi start sáng sớm + overnight (AC10)
 * - Duration preview với "→" và "+1 ngày" badge (AC8)
 * - Disabled submit khi có lỗi (AC8)
 * - Client-side overlap detection dùng UTC epoch
 */
export function SlotForm({
  open,
  onOpenChange,
  weekOf,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  existingSlots,
  onSubmit,
  isLoading = false,
  userTimezone,
  tenantTimezone,
}: SlotFormProps) {
  // Generate days Mon–Sun cho tuần này
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(parseISO(weekOf), i)
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE dd/MM', { locale: vi }),
    }
  })

  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      slotDate: defaultDate ?? weekOf,
      startTime: defaultStartTime ?? '09:00',
      endTime: defaultEndTime ?? '17:00',
      isOvernight: false,
    },
  })

  // Reset form chỉ khi open transition từ false → true (P6)
  // Dùng wasOpenRef để tránh reset khi props thay đổi trong lúc form đang mở,
  // vì react-hook-form.reset() sẽ xóa input của user đang gõ dở.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      form.reset({
        slotDate: defaultDate ?? weekOf,
        startTime: defaultStartTime ?? '09:00',
        endTime: defaultEndTime ?? '17:00',
        isOvernight: false,
      })
    }
    wasOpenRef.current = open
  }, [open, defaultDate, defaultStartTime, defaultEndTime, weekOf, form])

  const watchedValues = form.watch()
  const { startTime, endTime, isOvernight } = watchedValues

  // Tính duration preview
  const durationPreview = (() => {
    if (!startTime || !endTime) return null
    try {
      const mins = calcDurationMinutes(watchedValues)
      if (mins < 30 || mins > 720) return null
      return formatDuration(mins)
    } catch {
      return null
    }
  })()

  // End time options (AC9):
  // - Overnight mode: chỉ sáng sớm hôm sau (00:00–06:00)
  // - Normal mode: chỉ times > startTime
  const endTimeOptions = (() => {
    if (isOvernight) {
      return OVERNIGHT_END_OPTIONS
    }
    return TIME_OPTIONS.filter((t) => t > startTime)
  })()

  // AC10: Hint text khi isOvernight=true và start time ở sáng sớm (00:00–06:00)
  // Dùng string compare thay vì integer để tránh nhầm 06:30 (hour=6 nhưng ngoài range)
  const showNextDayHint = isOvernight &&
    endTime !== '' &&
    startTime <= '06:00'  // "06:00" <= "06:00" = true; "06:30" <= "06:00" = false ✓

  // Disabled submit khi có validation error (AC8)
  const hasAnyError = Object.keys(form.formState.errors).length > 0

  function handleSubmit(values: SlotFormValues) {
    // Validate slotDate nằm trong tuần hiện tại
    const weekStart = parseISO(weekOf)
    const weekEnd = addDays(weekStart, 6)
    const slotDate = parseISO(values.slotDate)
    if (slotDate < weekStart || slotDate > weekEnd) {
      form.setError('slotDate', { message: 'Ngày phải nằm trong tuần này' })
      return
    }

    // Auto-detect overnight nếu end <= start
    const overnight = values.isOvernight || values.endTime <= values.startTime
    const finalValues: SlotFormValues = { ...values, isOvernight: overnight }

    // Client-side overlap check
    const { startTimeUTC, durationMinutes } = convertSlotToUTC(finalValues, userTimezone, tenantTimezone)
    if (hasOverlapWithExisting(startTimeUTC, durationMinutes, existingSlots)) {
      form.setError('startTime', { message: 'Thời gian này bị trùng với slot khác.' })
      return
    }

    onSubmit(finalValues)
    form.reset()
  }

  function handleClose(open: boolean) {
    if (!open) form.reset()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm ca làm việc</DialogTitle>
          <DialogDescription>
            Chọn ngày và thời gian làm việc trong tuần này.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Ngày trong tuần */}
            <FormField
              control={form.control}
              name="slotDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ngày" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {weekDays.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Thời gian: Start → End với "+1 ngày" badge (AC8) */}
            <div className="flex items-end gap-2">
              {/* Start time */}
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Bắt đầu</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val)
                        // Reset end time nếu không còn hợp lệ (non-overnight)
                        if (!isOvernight && endTime <= val) {
                          const nextTime = TIME_OPTIONS.find((t) => t > val) ?? '23:30'
                          form.setValue('endTime', nextTime)
                          form.setValue('isOvernight', false)
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Dấu → ở giữa (AC8) */}
              <span className="text-muted-foreground pb-2">→</span>

              {/* End time với "+1 ngày" badge (AC8) */}
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Kết thúc</FormLabel>
                    <div className="flex items-center gap-1.5">
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val)
                          // Auto-detect overnight: nếu endTime <= startTime → overnight
                          form.setValue('isOvernight', val <= form.getValues('startTime'))
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {endTimeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                          {/* Non-overnight mode: hiển thị ngăn cách và các giờ overnight */}
                          {!isOvernight && (
                            <SelectItem value="__overnight_separator__" disabled>
                              ── Ngày hôm sau ──
                            </SelectItem>
                          )}
                          {!isOvernight &&
                            OVERNIGHT_END_OPTIONS.filter((t) => t <= startTime).map((t) => (
                              <SelectItem key={`overnight-${t}`} value={t}>
                                {t} (hôm sau)
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {/* "+1 ngày" badge thay cho "Hủy qua đêm" link (AC8) */}
                      {isOvernight && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                          +1 ngày
                        </span>
                      )}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Error message dưới cả time row (AC8) — không dưới từng field riêng */}
            {(form.formState.errors.startTime || form.formState.errors.endTime) && (
              <p className="text-sm text-destructive">
                {form.formState.errors.startTime?.message ??
                  form.formState.errors.endTime?.message}
              </p>
            )}

            {/* Duration preview với (qua đêm) label */}
            {durationPreview && (
              <p className="text-sm text-muted-foreground">
                ⏱ {durationPreview}
                {isOvernight && (
                  <span className="ml-1.5 text-xs text-yellow-600">(qua đêm)</span>
                )}
              </p>
            )}

            {/* AC10: Hint text khi start sáng sớm + overnight */}
            {showNextDayHint && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded p-2">
                💡 Ca hoàn toàn trong sáng ngày hôm sau? Hãy chọn ngày tiếp theo trong dropdown bên trên.
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Hủy
              </Button>
              {/* AC8: disabled khi có bất kỳ lỗi nào */}
              <Button type="submit" disabled={isLoading || hasAnyError}>
                {isLoading ? 'Đang lưu...' : 'Thêm slot →'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
