import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getMembers } from '@/features/tenant/services/tenant.service'
import { useCreateIncident } from '@/features/incidents/hooks/use-create-incident'
import {
  createIncidentSchema,
  INCIDENT_CATEGORY_LABELS,
  type CreateIncidentInput,
} from '@/features/incidents/schemas/incident.schema'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface CreateIncidentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string | null
  currentUserId: string | undefined
}

export function CreateIncidentDialog({
  open,
  onOpenChange,
  tenantId,
  currentUserId,
}: CreateIncidentDialogProps) {
  const createIncident = useCreateIncident(tenantId)

  // Fetch active members — reuse getMembers từ tenant.service.ts (không viết lại query)
  const { data: allMembers = [] } = useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, tenantId],
    queryFn: () => getMembers(tenantId!),
    staleTime: 60 * 1000,
    enabled: !!tenantId && open,
  })

  // Filter bỏ bản thân — DB constraint cũng enforce member_id <> manager_id
  const eligibleMembers = allMembers.filter((m) => m.user_id !== currentUserId)

  const form = useForm<CreateIncidentInput>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      memberId: '',
      // category: omitted intentionally → undefined triggers required_error 'Vui lòng chọn loại incident'
      note: '',
    },
  })

  // Reset form khi dialog đóng
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  function handleSubmit(data: CreateIncidentInput) {
    if (!tenantId || !currentUserId) return

    createIncident.mutate(
      {
        tenantId,
        memberId:  data.memberId,
        managerId: currentUserId,
        category:  data.category,
        note:      data.note,
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
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-destructive' />
            Ghi nhận Incident
          </DialogTitle>
          <DialogDescription>
            Ghi nhận vi phạm hoặc sự cố của thành viên. Incident là bất biến và không thể chỉnh sửa sau khi tạo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            {/* Member Select */}
            <FormField
              control={form.control}
              name='memberId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thành viên</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn thành viên...' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eligibleMembers.length === 0 ? (
                        <SelectItem value='__empty__' disabled>
                          Không có thành viên nào
                        </SelectItem>
                      ) : (
                        eligibleMembers.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.users.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category Select */}
            <FormField
              control={form.control}
              name='category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại incident</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn loại...' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Note Textarea */}
            <FormField
              control={form.control}
              name='note'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Mô tả sự cố, hành vi vi phạm...'
                      className='resize-none'
                      rows={4}
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
                disabled={createIncident.isPending}
              >
                Hủy
              </Button>
              <Button
                type='submit'
                variant='destructive'
                disabled={createIncident.isPending}
              >
                {createIncident.isPending ? 'Đang ghi nhận...' : 'Xác nhận'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
