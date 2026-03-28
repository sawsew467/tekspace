import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, parseISO, isValid } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { CalendarDays, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { usePermissions } from '@/hooks/use-permissions'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { ScheduleService } from '@/features/schedule/services/schedule.service'
import { useTodayReport } from '@/features/daily-report/hooks/use-today-report'
import { useSubmitReport } from '@/features/daily-report/hooks/use-submit-report'
import { useUpdateReport } from '@/features/daily-report/hooks/use-update-report'
import { useTeamReports, useActiveMembers } from '@/features/daily-report/hooks/use-team-reports'
import { useInfiniteReports } from '@/features/daily-report/hooks/use-infinite-reports'
import { useReportDates } from '@/features/daily-report/hooks/use-report-dates'
import { DailyReportForm } from '@/features/daily-report/components/DailyReportForm'
import { DailyReportView } from '@/features/daily-report/components/DailyReportView'
import { TeamReportList } from '@/features/daily-report/components/TeamReportList'
import { ReportHistoryList } from '@/features/daily-report/components/ReportHistoryList'
import {
  computeStreak,
  isWithinEditWindow,
  type DailyReportFormValues,
} from '@/features/daily-report/schemas/daily-report.schema'
import type { TaskPayload } from '@/features/daily-report/services/daily-report.service'
import { PageContainer } from '@/components/layout/page-container'

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
  const { activeRole } = usePermissions()
  const isManager = activeRole === 'manager' || activeRole === 'owner'

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

  // Story 4.6: Daily report deadline hour — dùng để tính edit window
  const { data: deadlineHourRaw, isLoading: isDeadlineLoading } = useQuery({
    queryKey: ['tenant-deadline', activeTenantId],
    queryFn: () => ScheduleService.getTenantDailyReportDeadline(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 10 * 60 * 1000,
  })
  // null-safe: service đã ?? 3, nhưng double-guard ở đây cho TypeScript type safety
  const resolvedDeadlineHour = deadlineHourRaw ?? 3

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
  const updateReport = useUpdateReport()

  const isLoading = isProfileLoading || isTenantLoading || isReportLoading

  // Story 4.6: Edit mode state
  const [isEditing, setIsEditing] = useState(false)

  // Story 4.6: Tick mỗi 30s để canEdit tự expire sau deadline (P-6)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Story 4.6: Reset editing khi chuyển ngày (timezone thay đổi → reportDate thay đổi)
  useEffect(() => {
    setIsEditing(false)
  }, [reportDate])

  // Story 4.6: Tính canEdit — chờ deadline query load xong, check realtime qua tick (P-6, P-7)
  const canEdit = useMemo(() => {
    if (!todayReport || isDeadlineLoading) return false
    return isWithinEditWindow(todayReport.report_date, resolvedDeadlineHour, timezone)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayReport, isDeadlineLoading, resolvedDeadlineHour, timezone, tick])

  // Story 9.2: Derive defaultValues từ todayReport cho edit form (pre-fill)
  // todayReport giờ là DailyReportWithTasks — tasks là report_tasks relational rows
  const editDefaultValues = useMemo((): DailyReportFormValues | undefined => {
    if (!todayReport) return undefined

    const sortedTasks = [...(todayReport.report_tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order)

    // Section 1: completed tasks
    const tasks = sortedTasks
      .filter(t => t.task_type !== 'in_progress')
      .map(t => ({
        task_type: 'completed' as const,
        project_tag: t.project_tag ?? '',
        description: t.description,
        output_type: (t.output_type ?? 'other') as DailyReportFormValues['tasks'][number]['output_type'],
        output_link: t.output_link ?? '',
        hours: t.hours ?? 0,
      }))

    // Section 2: in_progress tasks
    const in_progress_tasks = sortedTasks
      .filter(t => t.task_type === 'in_progress')
      .map(t => ({
        task_type: 'in_progress' as const,
        project_tag: t.project_tag ?? '',
        description: t.description,
        hours: t.hours ?? 0,
      }))

    return {
      tasks: tasks.length > 0 ? tasks : [{ task_type: 'completed' as const, project_tag: '', description: '', output_type: 'other', output_link: '', hours: 0 }],
      in_progress_tasks,
      plan_for_tomorrow: todayReport.plan_for_tomorrow ?? '',
      blockers: todayReport.blockers ?? '',
      hours_logged: todayReport.hours_logged,
    }
  }, [todayReport])

  function handleSubmit(values: DailyReportFormValues) {
    if (!activeTenantId || !user?.id) return

    // Section 1: completed tasks
    const completedTasks: TaskPayload[] = values.tasks.map((t) => ({
      task_type: 'completed' as const,
      project_tag: t.project_tag || undefined,
      description: t.description,
      output_type: t.output_type,
      ...(t.output_link ? { output_link: t.output_link } : {}),
      ...(t.hours !== undefined ? { hours: t.hours } : {}),
    }))

    // Section 2: in_progress tasks
    const inProgressTasks: TaskPayload[] = (values.in_progress_tasks ?? []).map((t) => ({
      task_type: 'in_progress' as const,
      project_tag: t.project_tag || undefined,
      description: t.description,
      hours: t.hours,
    }))

    submitReport.mutate({
      tenantId: activeTenantId,
      userId: user.id,
      reportDate,
      tasks: [...completedTasks, ...inProgressTasks],
      hoursLogged: values.hours_logged,
      planForTomorrow: values.plan_for_tomorrow || undefined,
      blockers: values.blockers || undefined,
    })
  }

  // Story 4.6 + 9.2: Submit update report với 4 sections
  function handleUpdate(values: DailyReportFormValues) {
    if (!todayReport) return

    const completedTasks: TaskPayload[] = values.tasks.map((t) => ({
      task_type: 'completed' as const,
      project_tag: t.project_tag || undefined,
      description: t.description,
      output_type: t.output_type,
      ...(t.output_link ? { output_link: t.output_link } : {}),
      ...(t.hours !== undefined ? { hours: t.hours } : {}),
    }))

    const inProgressTasks: TaskPayload[] = (values.in_progress_tasks ?? []).map((t) => ({
      task_type: 'in_progress' as const,
      project_tag: t.project_tag || undefined,
      description: t.description,
      hours: t.hours,
    }))

    updateReport.mutate(
      {
        reportId: todayReport.id,
        tasks: [...completedTasks, ...inProgressTasks],
        hoursLogged: values.hours_logged,
        planForTomorrow: values.plan_for_tomorrow || undefined,
        blockers: values.blockers || undefined,
      },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  // Format ngày hiển thị theo locale VN — memo cùng dependency với reportDate
  const reportDateDisplay = useMemo(
    () => format(toZonedTime(new Date(), timezone), 'EEEE, dd/MM/yyyy'),
    [timezone],
  )

  // ── History tab — lazy load ───────────────────────────────────────────────────

  // Chỉ fetch full history data khi user click tab "Lịch sử" lần đầu
  const [historyEnabled, setHistoryEnabled] = useState(false)

  const {
    data: allReportsData,
    isLoading: isHistoryLoading,
    fetchNextPage: fetchNextReportsPage,
    hasNextPage: hasNextReportsPage,
    isFetchingNextPage: isFetchingNextReportsPage,
  } = useInfiniteReports(
    historyEnabled ? activeTenantId ?? null : null,
    historyEnabled ? (user?.id ?? null) : null,
  )

  const allReports = useMemo(
    () => allReportsData?.pages.flatMap((p) => p) ?? [],
    [allReportsData?.pages],
  )

  // ── Streak — eager lightweight fetch (chỉ lấy dates, không cần click tab) ────

  const { data: reportDates = [] } = useReportDates(
    activeTenantId ?? null,
    user?.id ?? null,
  )

  const streak = useMemo(
    () => computeStreak(reportDates, reportDate),
    [reportDates, reportDate],
  )

  // ── Manager view: date navigation ────────────────────────────────────────────

  // viewDate: ngày đang xem trong Team Reports (mặc định = ngày hôm nay)
  // Sync với reportDate sau khi timezone được resolve (tránh init với 'UTC' rồi nhảy)
  const [viewDate, setViewDate] = useState(reportDate)
  useEffect(() => {
    setViewDate(reportDate)
  }, [reportDate])

  // F6: isValid guard để tránh RangeError khi viewDate không phải ISO hợp lệ
  const handlePrevDay = () =>
    setViewDate(prev => {
      const parsed = parseISO(prev)
      return isValid(parsed) ? format(addDays(parsed, -1), 'yyyy-MM-dd') : prev
    })
  // F4: clamp không vượt quá reportDate (today) + F6: isValid guard
  const handleNextDay = () =>
    setViewDate(prev => {
      const parsed = parseISO(prev)
      if (!isValid(parsed)) return prev
      const next = format(addDays(parsed, 1), 'yyyy-MM-dd')
      return next <= reportDate ? next : prev
    })
  const isViewingToday = viewDate === reportDate

  // F6: isValid guard cho useMemo
  const viewDateDisplay = useMemo(() => {
    const parsed = parseISO(viewDate)
    return isValid(parsed) ? format(parsed, 'EEEE, dd/MM/yyyy') : viewDate
  }, [viewDate])

  // Manager queries — chỉ fetch khi isManager (truyền null để disable)
  const {
    data: teamReports = [],
    isLoading: isTeamLoading,
    isError: isTeamError,
    refetch: refetchTeamReports,
  } = useTeamReports(
    isManager ? activeTenantId : null,
    viewDate,
  )
  const {
    data: activeMembers = [],
    isLoading: isMembersLoading,
    isError: isMembersError,
    refetch: refetchMembers,
  } = useActiveMembers(
    isManager ? activeTenantId : null,
  )

  const isManagerDataLoading = isTeamLoading || isMembersLoading
  const isManagerDataError = isTeamError || isMembersError

  // Badge: số member chưa nộp report hôm nay
  const missingCount = useMemo(() => {
    if (!isManager) return 0
    const submittedUserIds = new Set(teamReports.map((r) => r.user_id))
    return activeMembers.filter((m) => !submittedUserIds.has(m.user_id)).length
  }, [isManager, teamReports, activeMembers])

  return (
    <PageContainer className='space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <CalendarDays className='h-6 w-6 text-primary' />
        <div>
          <h1 className='text-xl font-bold'>Daily Report</h1>
          <p className='text-sm text-muted-foreground capitalize'>{reportDateDisplay}</p>
        </div>
      </div>

      {/* Tabs layout */}
      <Tabs
        defaultValue='today'
        onValueChange={(val) => {
          if (val === 'history') setHistoryEnabled(true)
          if (val !== 'today') setIsEditing(false)  // P-9: reset edit mode khi rời tab Hôm nay
        }}
      >
        <TabsList className={isManager ? 'grid w-full grid-cols-3' : 'grid w-full grid-cols-2'}>
          <TabsTrigger value='today'>Hôm nay</TabsTrigger>
          <TabsTrigger value='history'>
            Lịch sử
            {streak > 0 && (
              <span className='ml-1.5 text-orange-500 text-xs font-semibold'>🔥{streak}</span>
            )}
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value='team'>
              Team
              {missingCount > 0 && (
                <span
                  className='ml-1.5 text-xs font-semibold text-destructive'
                  aria-label={`${missingCount} thành viên chưa nộp`}
                >
                  ● {missingCount}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: Hôm nay */}
        <TabsContent value='today'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                {isLoading
                  ? 'Đang tải...'
                  : todayReport
                    ? isEditing ? 'Chỉnh sửa report' : 'Report hôm nay'
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
                // Story 4.6: toggle giữa edit form và read-only view
                isEditing ? (
                  <DailyReportForm
                    key={`edit-${todayReport.id}-${todayReport.updated_at ?? 'init'}`}
                    onSubmit={handleUpdate}
                    isPending={updateReport.isPending}
                    defaultValues={editDefaultValues}
                    submitLabel='Cập nhật Report'
                    onCancel={() => setIsEditing(false)}
                  />
                ) : (
                  <DailyReportView
                    report={todayReport}
                    timezone={timezone}
                    showEditButton={canEdit}
                    onEdit={() => setIsEditing(true)}
                  />
                )
              ) : (
                <DailyReportForm onSubmit={handleSubmit} isPending={submitReport.isPending} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Lịch sử — read-only, không có edit button */}
        <TabsContent value='history'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Lịch sử nộp report</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportHistoryList
                reports={allReports}
                timezone={timezone}
                isLoading={isHistoryLoading}
                hasNextPage={hasNextReportsPage}
                isFetchingNextPage={isFetchingNextReportsPage}
                onLoadMore={fetchNextReportsPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Team — chỉ Manager/Owner */}
        {isManager && (
          <TabsContent value='team'>
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between flex-wrap gap-2'>
                  <div className='flex items-center gap-2'>
                    <Users className='h-4 w-4 text-muted-foreground' />
                    <CardTitle className='text-base'>Team Reports</CardTitle>
                  </div>

                  {/* Date navigation — F1: date span là clickable Popover/Calendar */}
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={handlePrevDay}
                      aria-label='Ngày trước'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>

                    {/* F1: date picker qua Popover + Calendar */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 min-w-[160px] text-sm text-muted-foreground capitalize'
                          aria-label='Chọn ngày'
                        >
                          {viewDateDisplay}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className='w-auto p-0' align='center'>
                        <Calendar
                          mode='single'
                          selected={parseISO(viewDate)}
                          onSelect={date => {
                            if (date) setViewDate(format(date, 'yyyy-MM-dd'))
                          }}
                          // Disable future dates (chỉ xem lịch sử)
                          disabled={date => format(date, 'yyyy-MM-dd') > reportDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    {/* F4: disabled khi viewDate >= reportDate (không cho navigate vào tương lai) */}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={handleNextDay}
                      disabled={viewDate >= reportDate}
                      aria-label='Ngày sau'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                    {!isViewingToday && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-7 text-xs text-muted-foreground'
                        onClick={() => setViewDate(reportDate)}
                      >
                        Hôm nay
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isManagerDataLoading ? (
                  <div className='space-y-2'>
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className='h-12 w-full rounded-lg' />
                    ))}
                  </div>
                ) : isManagerDataError ? (
                  // F5: error state — network error / RLS rejection
                  <div className='flex flex-col items-center justify-center py-8 text-center gap-3'>
                    <p className='text-sm text-muted-foreground'>
                      Không thể tải dữ liệu team reports. Vui lòng thử lại.
                    </p>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        void refetchTeamReports()
                        void refetchMembers()
                      }}
                    >
                      Thử lại
                    </Button>
                  </div>
                ) : (
                  <TeamReportList
                    members={activeMembers}
                    reports={teamReports}
                    timezone={timezone}
                    currentUserId={user?.id ?? null}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  )
}
