import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Clock } from 'lucide-react'
import { useUpdateMemberCommittedHours } from '@/features/tenant/hooks/use-update-member-committed-hours'
import { usePermissions } from '@/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

// P1: dùng Number() thay parseInt để decimal (4.9) không bị truncate ngầm.
// Zod .int() sẽ bắt đúng error với message "Phải là số nguyên".
// .refine(v => v === null || isFinite(v)) loại NaN và Infinity trước khi đến .int().
const committedHoursSchema = z.object({
  committedHours: z
    .number({ invalid_type_error: 'Vui lòng nhập số' })
    .refine((v) => isFinite(v), { message: 'Vui lòng nhập số hợp lệ' })
    .int('Phải là số nguyên')
    .min(1, 'Tối thiểu 1 giờ')
    .max(168, 'Tối đa 168 giờ')
    .nullable(),
})
type CommittedHoursInput = z.infer<typeof committedHoursSchema>

interface SetCommittedHoursDialogProps {
  memberId: string
  memberName: string
  // P8: dùng null tường minh, không để undefined lọt vào defaultValues
  currentCommittedHours: number | null
  defaultCommittedHours: number
}

export function SetCommittedHoursDialog({
  memberId,
  memberName,
  currentCommittedHours,
  defaultCommittedHours,
}: SetCommittedHoursDialogProps) {
  // P6: self-defending permission gate — bảo vệ nếu component được dùng ngoài MemberList
  const { canManageMembers } = usePermissions()

  const [open, setOpen] = useState(false)
  const mutation = useUpdateMemberCommittedHours()

  const form = useForm<CommittedHoursInput>({
    resolver: zodResolver(committedHoursSchema),
    // P8: explicit null fallback để tránh undefined làm form dirty từ đầu
    defaultValues: { committedHours: currentCommittedHours ?? null },
  })

  // P3: sync form khi prop thay đổi (ví dụ: background refetch khi dialog đang mở)
  useEffect(() => {
    if (open) {
      form.reset({ committedHours: currentCommittedHours ?? null })
    }
  }, [open, currentCommittedHours, form])

  const handleSubmit = (data: CommittedHoursInput) => {
    mutation.mutate(
      { memberId, committedHours: data.committedHours },
      { onSuccess: () => setOpen(false) }
    )
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Clear stale mutation error khi đóng dialog
      mutation.reset()
    }
    setOpen(isOpen)
  }

  // P6: nếu không có quyền, không render button (self-defending)
  if (!canManageMembers) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon' title='Chỉnh sửa giờ cam kết'>
          <Clock className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giờ cam kết — {memberName}</DialogTitle>
          <DialogDescription>
            Số giờ làm việc cam kết mỗi tuần. Mặc định nhóm: {defaultCommittedHours}h/tuần.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='committedHours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ cam kết / tuần</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={168}
                      step={1}
                      placeholder={`Mặc định nhóm: ${defaultCommittedHours}h`}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        // P1: Number() thay parseInt — decimal sẽ tạo float,
                        // Zod .int() bắt đúng với message "Phải là số nguyên"
                        field.onChange(e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Để trống để dùng mặc định nhóm ({defaultCommittedHours}h/tuần)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
