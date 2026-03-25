import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useCreateAppeal } from '@/features/incidents/hooks/use-create-appeal'
import {
  createAppealSchema,
  type CreateAppealInput,
} from '@/features/incidents/schemas/appeal.schema'
import { Button } from '@/components/ui/button'
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

interface AppealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId: string
  tenantId: string | null
  currentUserId: string | undefined
}

export function AppealDialog({
  open,
  onOpenChange,
  incidentId,
  tenantId,
  currentUserId,
}: AppealDialogProps) {
  const createAppeal = useCreateAppeal(tenantId)

  const form = useForm<CreateAppealInput>({
    resolver: zodResolver(createAppealSchema),
    defaultValues: {
      response: '',
    },
  })

  // Reset form khi dialog đóng
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  function handleSubmit(data: CreateAppealInput) {
    if (!tenantId || !currentUserId || !incidentId) {
      toast.error('Không thể gửi appeal — phiên làm việc không hợp lệ')
      return
    }

    createAppeal.mutate(
      {
        tenantId,
        incidentId,
        memberId: currentUserId,
        response: data.response,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Gửi Appeal</DialogTitle>
          <DialogDescription>
            Trình bày quan điểm của bạn về incident này. Appeal không thể chỉnh sửa sau khi gửi.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='response'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nội dung phản hồi</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Trình bày quan điểm của bạn về sự việc này...'
                      className='resize-none'
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={createAppeal.isPending}
              >
                Hủy
              </Button>
              <Button
                type='submit'
                disabled={createAppeal.isPending}
              >
                {createAppeal.isPending ? 'Đang gửi...' : 'Gửi Appeal'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
