import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { usePermissions } from '@/hooks/use-permissions'
import { QUERY_KEYS } from '@/lib/query-keys'
import { COMMON_TIMEZONES } from '@/lib/timezones'
import {
  teamSettingsSchema,
  type TeamSettingsInput,
} from '@/features/tenant/schemas/tenant.schema'
import {
  getTenantSettings,
  updateTenantSettings,
} from '@/features/tenant/services/tenant.service'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_app/team/settings')({
  head: () => ({
    meta: [{ title: 'Cài đặt nhóm — TekSpace' }],
  }),
  component: TeamSettingsPage,
})

const DAYS_OF_WEEK = [
  { value: 0, label: 'Chủ Nhật' },
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}))

function TeamSettingsPage() {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()
  const { canManageTenant } = usePermissions()

  const { data: settings, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getTenantSettings(activeTenantId)
    },
    enabled: !!activeTenantId,
  })

  const form = useForm<TeamSettingsInput>({
    resolver: zodResolver(teamSettingsSchema),
    defaultValues: {
      timezone: '',
      schedule_deadline_day: 0,
      schedule_deadline_hour: 23,
      daily_report_deadline_hour: 3,
      default_committed_hours: 40,
    },
    values: settings
      ? {
          timezone: settings.timezone,
          schedule_deadline_day: settings.schedule_deadline_day,
          schedule_deadline_hour: settings.schedule_deadline_hour,
          daily_report_deadline_hour: settings.daily_report_deadline_hour,
          default_committed_hours: settings.default_committed_hours,
        }
      : undefined,
  })

  // Radix Select sync on values prop change
  // eslint-disable-next-line react-hooks/incompatible-library
  const timezoneWatch = form.watch('timezone')

  const mutation = useMutation({
    mutationFn: (data: TeamSettingsInput) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return updateTenantSettings(activeTenantId, data)
    },
    onSuccess: () => {
      toast.success('Đã lưu cài đặt nhóm')
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
      })
    },
    onError: () => {
      toast.error('Không thể lưu cài đặt. Vui lòng thử lại.')
    },
  })

  if (isLoading) {
    return <div className='text-muted-foreground py-8 text-center text-sm'>Đang tải...</div>
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>
          Cài đặt nhóm{settings?.name ? ` — ${settings.name}` : ''}
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>Cấu hình deadline và timezone cho team</p>
      </div>

      {!canManageTenant ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          Chỉ Owner mới có thể thay đổi cài đặt nhóm.
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className='space-y-6'
          >
            {/* Timezone */}
            <FormField
              control={form.control}
              name='timezone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value ?? ''}
                    key={timezoneWatch || 'empty'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn timezone' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Schedule Deadline Day */}
            <FormField
              control={form.control}
              name='schedule_deadline_day'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày deadline nộp lịch</FormLabel>
                  <Select
                    name={field.name}
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={field.value !== undefined ? String(field.value) : ''}
                    key={timezoneWatch || 'empty'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn ngày' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Schedule Deadline Hour */}
            <FormField
              control={form.control}
              name='schedule_deadline_hour'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ deadline nộp lịch</FormLabel>
                  <Select
                    name={field.name}
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={field.value !== undefined ? String(field.value) : ''}
                    key={timezoneWatch || 'empty'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn giờ' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={String(h.value)}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Daily Report Deadline Hour */}
            <FormField
              control={form.control}
              name='daily_report_deadline_hour'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ deadline báo cáo ngày</FormLabel>
                  <Select
                    name={field.name}
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={field.value !== undefined ? String(field.value) : ''}
                    key={timezoneWatch || 'empty'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Chọn giờ' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={String(h.value)}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Default Committed Hours — FIX 9: number input */}
            <FormField
              control={form.control}
              name='default_committed_hours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ cam kết mặc định / tuần</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={168}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10))
                      }
                    />
                  </FormControl>
                  <FormDescription>Số giờ làm việc cam kết mỗi tuần (1–168)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}
