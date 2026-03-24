import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format, parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  calcDurationMinutes,
  formatDuration,
} from '../schemas/schedule.schema'
import { hasOverlapWithExisting } from '../utils/schedule.utils'
import { convertSlotToUTC, type ScheduleSlot } from '../services/schedule.service'

// ── Time options (00:00–23:30, bước 30 phút) — giống SlotForm ────────────────

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const editSlotDialogSchema = z
  .object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu không hợp lệ')
      .refine(
        (t) => { const [, mm] = t.split(':').map(Number); return mm === 0 || mm === 30 },
        { message: 'Giờ bắt đầu phải là bội số 30 phút' }
      ),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc không hợp lệ')
      .refine(
        (t) => { const [, mm] = t.split(':').map(Number); return mm === 0 || mm === 30 },
        { message: 'Giờ kết thúc phải là bội số 30 phút' }
      ),
    isOvernight: z.boolean(),
    reason: z.string().trim().min(1, 'Lý do không được để trống'),
  })
  .refine(
    (data) => {
      const [sh, sm] = data.startTime.split(':').map(Number)
      const [eh, em] = data.endTime.split(':').map(Number)
      const startMins = sh * 60 + sm
      const endMins = eh * 60 + em
      const durationMins =
        data.isOvernight || endMins <= startMins
          ? 24 * 60 - startMins + endMins
          : endMins - startMins
      return durationMins >= 30 && durationMins <= 720
    },
    { message: 'Thời lượng slot phải từ 30 phút đến 12 giờ', path: ['endTime'] }
  )

type EditSlotFormValues = z.infer<typeof editSlotDialogSchema>

// ── Props ──────────────────────────────────────────────────────────────────────

interface EditSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: ScheduleSlot                 // slot đang edit (để pre-fill)
  existingSlots: ScheduleSlot[]      // để check overlap (exclude slot này)
  weekOf: string                     // Monday ISO date "YYYY-MM-DD"
  userTimezone: string
  tenantTimezone: string
  isEmergency?: boolean              // true = emergency override mode (slot đã lock)
  isLoading?: boolean
  onSubmit: (data: {
    newStartTimeUTC: Date
    newDurationMinutes: number
    reason: string
    isEmergency: boolean
  }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * getDefaultValues — tính toán giá trị pre-fill từ slot UTC → user timezone
 * Dùng toZonedTime để convert UTC → user timezone rồi format HH:mm
 */
function getDefaultValues(slot: ScheduleSlot, userTimezone: string): EditSlotFormValues {
  const startUtc = new Date(slot.start_time)
  const startInUserTz = toZonedTime(startUtc, userTimezone)
  const defaultStartTime = formatTz(startInUserTz, 'HH:mm', { timeZone: userTimezone })

  const endMs = startUtc.getTime() + slot.duration_minutes * 60 * 1000
  const endInUserTz = toZonedTime(new Date(endMs), userTimezone)
  const defaultEndTime = formatTz(endInUserTz, 'HH:mm', { timeZone: userTimezone })

  const isOvernight = defaultEndTime <= defaultStartTime

  return {
    slotDate: slot.slot_date,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    isOvernight,
    reason: '',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * EditSlotDialog — dialog để chỉnh sửa một slot đã có kèm lý do bắt buộc
 *
 * Features:
 * - Pre-fill thời gian từ slot hiện tại (convert UTC → user timezone)
 * - Chọn ngày/giờ bắt đầu/kết thúc (giống SlotForm)
 * - Overnight support
 * - Client-side overlap check (exclude slot đang edit)
 * - Lý do thay đổi bắt buộc (textarea)
 * - Emergency mode: hiển thị warning banner khi slot đã bị lock
 */
export function EditSlotDialog({
  open,
  onOpenChange,
  slot,
  existingSlots,
  weekOf,
  userTimezone,
  tenantTimezone,
  isEmergency = false,
  isLoading = false,
  onSubmit,
}: EditSlotDialogProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(parseISO(weekOf), i)
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE dd/MM', { locale: vi }),
    }
  })

  const form = useForm<EditSlotFormValues>({
    resolver: zodResolver(editSlotDialogSchema),
    defaultValues: getDefaultValues(slot, userTimezone),
  })

  // Reset form khi slot thay đổi (slot.id khác) — tránh stale pre-fill khi mở dialog cho slot mới
  // defaultValues chỉ apply lần mount đầu tiên, nên cần explicit reset khi slot prop thay đổi
  useEffect(() => {
    form.reset(getDefaultValues(slot, userTimezone))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.id])

  const watchedValues = form.watch()
  const { startTime, endTime, isOvernight } = watchedValues

  // Duration preview
  const durationPreview = (() => {
    if (!startTime || !endTime) return null
    try {
      const mins = calcDurationMinutes({ ...watchedValues, isOvernight: isOvernight ?? false })
      if (mins < 30 || mins > 720) return null
      return formatDuration(mins)
    } catch {
      return null
    }
  })()

  // End time options — giống SlotForm
  const endTimeOptions = TIME_OPTIONS.filter((t) => {
    if (isOvernight) return true
    return t > startTime
  })

  function handleSubmit(values: EditSlotFormValues) {
    // Validate slotDate nằm trong tuần hiện tại
    const weekStart = parseISO(weekOf)
    const weekEnd = addDays(weekStart, 6)
    const slotDate = parseISO(values.slotDate)
    if (slotDate < weekStart || slotDate > weekEnd) {
      form.setError('slotDate', { message: 'Ngày phải nằm trong tuần này' })
      return
    }

    const overnight = values.isOvernight || values.endTime <= values.startTime
    const finalValues = { ...values, isOvernight: overnight }

    // Client-side overlap check — exclude slot đang được edit
    const { startTimeUTC, durationMinutes } = convertSlotToUTC(
      finalValues,
      userTimezone,
      tenantTimezone
    )
    if (hasOverlapWithExisting(startTimeUTC, durationMinutes, existingSlots, slot.id)) {
      form.setError('startTime', { message: 'Thời gian này bị trùng với slot khác.' })
      return
    }

    onSubmit({
      newStartTimeUTC: startTimeUTC,
      newDurationMinutes: durationMinutes,
      reason: values.reason.trim(),
      isEmergency,
    })
  }

  function handleClose(open: boolean) {
    if (!open) {
      form.reset(getDefaultValues(slot, userTimezone))
    }
    onOpenChange(open)
  }

  function cancelOvernight() {
    const currentStart = form.getValues('startTime')
    const nextTime = TIME_OPTIONS.find((t) => t > currentStart)
    if (!nextTime) return  // startTime=23:30: không có slot tiếp theo — nút đã bị disabled
    form.setValue('isOvernight', false)
    form.setValue('endTime', nextTime)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEmergency ? 'Emergency Override' : 'Chỉnh sửa ca làm việc'}
          </DialogTitle>
          <DialogDescription>
            {isEmergency
              ? 'Ca này đã bắt đầu. Nhập lý do để tiếp tục.'
              : 'Cập nhật thời gian và nhập lý do thay đổi.'}
          </DialogDescription>
        </DialogHeader>

        {/* Emergency warning banner */}
        {isEmergency && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            ⚠️ Emergency Override — ca này đã bắt đầu. Hành động này sẽ được ghi lại và manager sẽ được thông báo.
          </div>
        )}

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
              {/* Start time */}
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bắt đầu</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val)
                        if (!isOvernight && endTime <= val) {
                          const nextTime =
                            TIME_OPTIONS.find((t) => t > val) ?? '23:30'
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

            {/* Duration preview + overnight */}
            {durationPreview && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Thời lượng:{' '}
                  <span className="font-medium text-foreground">{durationPreview}</span>
                  {(isOvernight || endTime <= startTime) && (
                    <span className="ml-2 text-xs text-yellow-600">(qua đêm)</span>
                  )}
                </p>
                {isOvernight && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    onClick={cancelOvernight}
                    disabled={!TIME_OPTIONS.find((t) => t > startTime)}
                    title={!TIME_OPTIONS.find((t) => t > startTime) ? 'Không thể hủy qua đêm khi bắt đầu lúc 23:30' : undefined}
                  >
                    Hủy qua đêm
                  </button>
                )}
              </div>
            )}

            {/* Lý do thay đổi — bắt buộc */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Lý do {isEmergency ? 'Emergency Override' : 'thay đổi'}{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Nhập lý do thay đổi..."
                      className="resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                variant={isEmergency ? 'destructive' : 'default'}
              >
                {isLoading
                  ? 'Đang lưu...'
                  : isEmergency
                    ? 'Xác nhận Override'
                    : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
