import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ScheduleSlot } from '../services/schedule.service'
import { formatDuration } from '../schemas/schedule.schema'

// ── Zod schema ────────────────────────────────────────────────────────────────

const deleteSlotSchema = z.object({
  reason: z.string().trim().min(1, 'Lý do không được để trống'),
})

type DeleteSlotFormValues = z.infer<typeof deleteSlotSchema>

// ── Props ──────────────────────────────────────────────────────────────────────

interface DeleteSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: ScheduleSlot                 // P-5: parent null-guards trước khi render component này
  userTimezone: string
  isEmergency?: boolean              // true = locked slot emergency delete
  isLoading?: boolean
  onConfirm: (data: { reason: string; isEmergency: boolean }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSlotInfo(slot: ScheduleSlot, userTimezone: string): string {
  const startInUserTz = toZonedTime(new Date(slot.start_time), userTimezone)
  const startStr = format(startInUserTz, 'EEEE dd/MM, HH:mm', { locale: vi })
  const durationStr = formatDuration(slot.duration_minutes)
  return `${startStr} (${durationStr})`
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * DeleteSlotDialog — dialog xác nhận xóa slot với lý do bắt buộc
 *
 * Features:
 * - Hiển thị thông tin slot đang xóa (ngày, giờ, thời lượng)
 * - Textarea lý do xóa (required)
 * - Emergency mode: warning banner khi slot đã lock
 */
export function DeleteSlotDialog({
  open,
  onOpenChange,
  slot,
  userTimezone,
  isEmergency = false,
  isLoading = false,
  onConfirm,
}: DeleteSlotDialogProps) {
  const form = useForm<DeleteSlotFormValues>({
    resolver: zodResolver(deleteSlotSchema),
    defaultValues: { reason: '' },
  })

  function handleSubmit(values: DeleteSlotFormValues) {
    onConfirm({ reason: values.reason.trim(), isEmergency })
  }

  function handleClose(open: boolean) {
    if (!open) form.reset()
    onOpenChange(open)
  }

  const slotInfo = formatSlotInfo(slot, userTimezone)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEmergency ? 'Xóa ca (Emergency Override)' : 'Xóa ca làm việc'}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{slotInfo}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Emergency warning banner */}
        {isEmergency && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            ⚠️ Emergency Override — ca này đã bắt đầu. Hành động xóa sẽ được ghi lại và manager sẽ được thông báo.
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Lý do xóa — bắt buộc */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Lý do xóa <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Nhập lý do xóa ca làm việc..."
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
                variant="destructive"
                disabled={isLoading}
              >
                {isLoading ? 'Đang xóa...' : 'Xóa ca'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
