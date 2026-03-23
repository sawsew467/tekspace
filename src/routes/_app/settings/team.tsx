import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
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

export const Route = createFileRoute('/_app/settings/team')({
  component: TeamSettingsPage,
})

const COMMON_TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Hồ Chí Minh (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (UTC+5:30)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
]

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
  const { activeTenantId, activeRole } = useTenantStore()
  const queryClient = useQueryClient()
  const isOwner = activeRole === 'owner'

  // F6+F11: Bỏ `isOwner` khỏi enabled — query chạy cho mọi role
  // Non-owner cũng cần fetch để hiển thị tên team trong read-only view
  // F5: Explicit guard trong queryFn thay vì non-null assertion (activeTenantId!)
  const { data: settings, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getTenantSettings(activeTenantId)
    },
    enabled: !!activeTenantId,
  })

  // F9: defaultValues để tránh uncontrolled→controlled React warning khi form mount
  // trước khi settings load xong.
  // values prop (shadcn/RHF docs): sync form với server data khi settings load/refetch.
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

  // P-14 fix: Radix Select không sync visual state khi value prop thay đổi programmatically.
  // Cần key remount, nhưng key phải đổi SAU KHI form state được cập nhật.
  // form.watch() tạo subscription → khi values prop trigger reset() trong RHF,
  // watch notification → TeamSettingsPage re-render → timezoneWatch = giá trị mới
  // → key đổi → Selects remount → đọc đúng field.value. Đây là cách docs khuyến nghị.
  // eslint-disable-next-line react-hooks/incompatible-library
  const timezoneWatch = form.watch('timezone')

  const mutation = useMutation({
    mutationFn: (data: TeamSettingsInput) => {
      // P-09: guard activeTenantId null trước khi call service
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

  // F6: isLoading check TRƯỚC !isOwner — đúng vì query giờ chạy cho mọi role
  // Spinner hiển thị đúng cho cả owner lẫn non-owner trong lúc fetch
  if (isLoading) {
    return <div className='text-muted-foreground py-8 text-center text-sm'>Đang tải...</div>
  }

  // F11: Non-owner thấy tên team + message read-only (query đã enabled ở trên)
  if (!isOwner) {
    return (
      <div className='mx-auto max-w-2xl p-6'>
        <div className='mb-6'>
          <h1 className='text-2xl font-semibold'>
            Cài đặt nhóm{settings?.name ? ` — ${settings.name}` : ''}
          </h1>
        </div>
        <div className='text-muted-foreground py-8 text-center text-sm'>
          Chỉ Owner mới có thể thay đổi cài đặt nhóm.
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-2xl p-6'>
      <div className='mb-6'>
        {/* P-13: hiển thị tên team (đã fetch từ getTenantSettings) */}
        <h1 className='text-2xl font-semibold'>
          Cài đặt nhóm{settings?.name ? ` — ${settings.name}` : ''}
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Cấu hình timezone và deadline cho team của bạn.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className='space-y-6'>
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
                  // P-04: guard undefined trước String() để tránh "undefined" value
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

          {/* Default Committed Hours */}
          <FormField
            control={form.control}
            name='default_committed_hours'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giờ cam kết mặc định (giờ/tuần)</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={168}
                    step={1}
                    {...field}
                    // F7: Luôn truyền number vào field.onChange, không truyền '' (string)
                    // Khi user xóa input → 0 → z.coerce coerce 0 → fail min(1) → "Tối thiểu 1 giờ"
                    // Tránh type mismatch giữa internal RHF state (string) và schema type (number)
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
