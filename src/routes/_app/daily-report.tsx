import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { CalendarDays } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { ScheduleService } from '@/features/schedule/services/schedule.service'
import { useTodayReport } from '@/features/daily-report/hooks/use-today-report'
import { useSubmitReport } from '@/features/daily-report/hooks/use-submit-report'
import { DailyReportForm } from '@/features/daily-report/components/DailyReportForm'
import { DailyReportView } from '@/features/daily-report/components/DailyReportView'
import type { DailyReportFormValues } from '@/features/daily-report/schemas/daily-report.schema'

// Validate timezone string để tránh RangeError từ toZonedTime
function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const Route = createFileRoute('/_app/daily-report')({
  head: () => ({
    meta: [{ title: 'Daily Report — TekSpace' }],
  }),
  component: DailyReportPage,
})

function DailyReportPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // User profile (lấy timezone của user)
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Tenant timezone (fallback nếu user chưa set timezone)
  const { data: tenantTimezone = 'UTC', isLoading: isTenantLoading } = useQuery({
    queryKey: ['tenant-timezone', activeTenantId],
    queryFn: () => ScheduleService.getTenantTimezone(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 10 * 60 * 1000,
  })

  // Timezone ưu tiên: user timezone → tenant timezone → 'UTC'
  // Validate trước để toZonedTime không throw RangeError với giá trị invalid
  const rawTimezone = userProfile?.timezone || tenantTimezone || 'UTC'
  const timezone = useMemo(() => (isValidTimezone(rawTimezone) ? rawTimezone : 'UTC'), [rawTimezone])

  // Ngày hôm nay theo timezone của user — memo để không đổi giá trị giữa các re-render
  const reportDate = useMemo(
    () => format(toZonedTime(new Date(), timezone), 'yyyy-MM-dd'),
    [timezone],
  )

  // Kiểm tra xem hôm nay đã submit report chưa
  const { data: todayReport, isLoading: isReportLoading } = useTodayReport(
    activeTenantId,
    user?.id ?? null,
    reportDate,
  )

  const submitReport = useSubmitReport()

  const isLoading = isProfileLoading || isTenantLoading || isReportLoading

  function handleSubmit(values: DailyReportFormValues) {
    if (!activeTenantId || !user?.id) return
    submitReport.mutate({
      tenantId: activeTenantId,
      userId: user.id,
      reportDate,
      tasks: values.tasks.map((t) => ({
        description: t.description,
        output_type: t.output_type,
        // Omit empty output_link
        ...(t.output_link ? { output_link: t.output_link } : {}),
      })),
      hoursLogged: values.hours_logged,
    })
  }

  // Format ngày hiển thị theo locale VN — memo cùng dependency với reportDate
  const reportDateDisplay = useMemo(
    () => format(toZonedTime(new Date(), timezone), 'EEEE, dd/MM/yyyy'),
    [timezone],
  )

  return (
    <div className='container max-w-2xl py-6 space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <CalendarDays className='h-6 w-6 text-primary' />
        <div>
          <h1 className='text-xl font-bold'>Daily Report</h1>
          <p className='text-sm text-muted-foreground capitalize'>{reportDateDisplay}</p>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {isLoading
              ? 'Đang tải...'
              : todayReport
                ? 'Report hôm nay'
                : 'Nộp report hôm nay'}
          </CardTitle>
          {!isLoading && !todayReport && (
            <CardDescription>
              Điền thông tin tasks đã hoàn thành và số giờ làm việc.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
          ) : todayReport ? (
            <DailyReportView report={todayReport} timezone={timezone} />
          ) : (
            <DailyReportForm onSubmit={handleSubmit} isPending={submitReport.isPending} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
