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

// ── Time options (00:00–23:30 + 24:00, bước 30 phút) ──────────────────────

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}
// Thêm 24:00 làm end time hợp lệ (AC2)
if (!TIME_OPTIONS.includes('24:00')) {
  TIME_OPTIONS.push('24:00')
}

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
  userTimezone: string           // IANA timezone của user (UI + overlap check)
  tenantTimezone: string         // IANA timezone của tenant (tính slot_date để lưu DB)
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SlotForm — dialog để thêm một time slot mới vào lịch tuần
 *
 * Features:
 * - Chọn ngày trong tuần (Mon–Sun) của week_of, pre-fill từ defaultDate
 * - Chọn start time và end time (30-min steps, end time bao gồm 24:00)
 * - Validation: endTime phải > startTime, duration 30–720 phút
 * - Duration preview
 * - Disabled submit khi có lỗi
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
  tenantTimezone,
  userTimezone,
}: SlotFormProps) {
  // Generate days Mon–Sun cho tuần này (hiển thị theo user timezone để khớp TimeGrid)
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
      })
    }
    wasOpenRef.current = open
  }, [open, defaultDate, defaultStartTime, defaultEndTime, weekOf, form])

  const watchedValues = form.watch()
  const { startTime, endTime } = watchedValues

  // Tính duration preview
  const durationPreview = (() => {
    if (!startTime || !endTime) return null
    try {
      const mins = calcDurationMinutes({ startTime, endTime })
      if (mins < 30 || mins > 720) return null
      return formatDuration(mins)
    } catch {
      return null
    }
  })()

  // End time options: luôn là t > startTime (AC3)
  const endTimeOptions = TIME_OPTIONS.filter((t) => t > startTime)

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

    // Client-side overlap check
    const { startTimeUTC, durationMinutes } = convertSlotToUTC(values, userTimezone, tenantTimezone)
    if (hasOverlapWithExisting(startTimeUTC, durationMinutes, existingSlots)) {
      form.setError('startTime', { message: 'Thời gian này bị trùng với slot khác.' })
      return
    }

    onSubmit(values)
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
                        // Reset end time nếu không còn hợp lệ (t > val)
                        if (endTime <= val) {
                          const nextTime = TIME_OPTIONS.find((t) => t > val) ?? '24:00'
                          form.setValue('endTime', nextTime)
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
                        </SelectContent>
                      </Select>
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

            {/* Duration preview */}
            {durationPreview && (
              <p className="text-sm text-muted-foreground">
                ⏱ {durationPreview}
              </p>
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
