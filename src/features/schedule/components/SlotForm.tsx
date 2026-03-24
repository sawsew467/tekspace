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

// ── Props ─────────────────────────────────────────────────────────────────────

interface SlotFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekOf: string                 // Monday ISO date "YYYY-MM-DD"
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
 * - Chọn ngày trong tuần (Mon–Sun) của week_of
 * - Chọn start time và end time (30-min steps, bao gồm 23:30)
 * - Overnight support: auto-detect khi endTime <= startTime
 * - Hiển thị duration preview ("2 giờ 30 phút")
 * - Client-side overlap detection dùng UTC epoch (chính xác với mọi timezone)
 * - Validate slotDate nằm trong tuần hiện tại
 */
export function SlotForm({
  open,
  onOpenChange,
  weekOf,
  existingSlots,
  onSubmit,
  isLoading = false,
  userTimezone,
  tenantTimezone,
}: SlotFormProps) {
  // Generate days Mon–Sun cho tuần này
  // Dùng parseISO() thay vì new Date() để tránh UTC-midnight timezone issue
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
      slotDate: weekOf,    // Default: thứ Hai của tuần
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
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

  // End time options: nếu không overnight → chỉ hiện times > startTime
  const endTimeOptions = TIME_OPTIONS.filter((t) => {
    if (isOvernight) return true
    return t > startTime
  })

  function handleSubmit(values: SlotFormValues) {
    // Validate slotDate nằm trong tuần hiện tại (NFR11)
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

    // Client-side overlap check dùng UTC epoch (P1+P2 fix)
    // Không filter theo slot_date → bắt được cả overnight cross-midnight overlaps
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

  function cancelOvernight() {
    form.setValue('isOvernight', false)
    const nextTime = TIME_OPTIONS.find((t) => t > form.getValues('startTime')) ?? '23:30'
    form.setValue('endTime', nextTime)
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

            <div className="grid grid-cols-2 gap-3">
              {/* Start time — bao gồm 23:30 (bỏ slice(0,-1) cũ) */}
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End time */}
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kết thúc</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val)
                        // Auto-detect overnight: nếu endTime <= startTime → overnight
                        // Dùng onValueChange thay vì onSelect (Radix-safe)
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
                        {/* Overnight section: hiển thị khi chưa chọn overnight */}
                        {!isOvernight && (
                          <SelectItem value="__overnight_separator__" disabled>
                            ── Ngày hôm sau ──
                          </SelectItem>
                        )}
                        {!isOvernight &&
                          TIME_OPTIONS.filter((t) => t <= startTime).map((t) => (
                            <SelectItem key={`overnight-${t}`} value={t}>
                              {t} (hôm sau)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration preview + overnight badge + cancel */}
            {durationPreview && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Thời lượng:{' '}
                  <span className="font-medium text-foreground">{durationPreview}</span>
                  {(isOvernight || endTime <= startTime) && (
                    <span className="ml-2 text-xs text-yellow-600">(qua đêm)</span>
                  )}
                </p>
                {/* Cho phép hủy overnight mode (P8) */}
                {isOvernight && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                    onClick={cancelOvernight}
                  >
                    Hủy qua đêm
                  </button>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Đang lưu...' : 'Thêm slot'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
