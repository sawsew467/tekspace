import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useCreateResolution } from '@/features/incidents/hooks/use-create-resolution'
import {
  createResolutionSchema,
  RESOLUTION_OUTCOME_LABELS,
  type CreateResolutionInput,
} from '@/features/incidents/schemas/resolution.schema'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ResolveIncidentDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  incidentId:   string
  tenantId:     string | null
  memberId:     string      // member của incident (để Edge Function notify)
  resolvedBy:   string      // user.id của Manager đang resolve
}

export function ResolveIncidentDialog({
  open,
  onOpenChange,
  incidentId,
  tenantId,
  memberId,
  resolvedBy,
}: ResolveIncidentDialogProps) {
  const createResolution = useCreateResolution(tenantId)

  const form = useForm<CreateResolutionInput>({
    resolver: zodResolver(createResolutionSchema),
    defaultValues: {
      outcome: undefined,
      note:    '',
    },
  })

  // Reset form khi dialog đóng
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  function handleSubmit(data: CreateResolutionInput) {
    if (!tenantId) return

    createResolution.mutate(
      {
        tenantId,
        incidentId,
        memberId,
        resolvedBy,
        outcome: data.outcome,
        note:    data.note || undefined,
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
          <DialogTitle>Giải quyết vi phạm</DialogTitle>
          <DialogDescription>
            Chọn kết quả xử lý cho incident này. Quyết định sẽ được ghi nhận và không thể thay đổi.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            {/* Outcome RadioGroup */}
            <FormField
              control={form.control}
              name='outcome'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kết quả xử lý</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className='space-y-2'
                    >
                      {/* Dismiss option */}
                      <div className='flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors'>
                        <RadioGroupItem value='dismissed' id='resolve-dismissed' />
                        <Label
                          htmlFor='resolve-dismissed'
                          className='flex items-center gap-2 cursor-pointer flex-1'
                        >
                          <XCircle className='h-4 w-4 text-muted-foreground shrink-0' />
                          <div>
                            <p className='text-sm font-medium'>{RESOLUTION_OUTCOME_LABELS.dismissed}</p>
                            <p className='text-xs text-muted-foreground'>Vi phạm không có cơ sở, incident bị bỏ qua</p>
                          </div>
                        </Label>
                      </div>

                      {/* Uphold option */}
                      <div className='flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors'>
                        <RadioGroupItem value='upheld' id='resolve-upheld' />
                        <Label
                          htmlFor='resolve-upheld'
                          className='flex items-center gap-2 cursor-pointer flex-1'
                        >
                          <CheckCircle2 className='h-4 w-4 text-destructive shrink-0' />
                          <div>
                            <p className='text-sm font-medium'>{RESOLUTION_OUTCOME_LABELS.upheld}</p>
                            <p className='text-xs text-muted-foreground'>Vi phạm được xác nhận và tính vào hồ sơ</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Resolution note — optional */}
            <FormField
              control={form.control}
              name='note'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Ghi chú kết quả{' '}
                    <span className='text-xs font-normal text-muted-foreground'>(tuỳ chọn)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Lý do quyết định, bằng chứng tham khảo...'
                      className='resize-none'
                      rows={3}
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
                disabled={createResolution.isPending}
              >
                Hủy
              </Button>
              <Button
                type='submit'
                disabled={createResolution.isPending || !form.watch('outcome')}
              >
                {createResolution.isPending ? 'Đang xử lý...' : 'Xác nhận'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
