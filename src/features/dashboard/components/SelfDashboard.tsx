import { useMemo, useState, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfISOWeek, endOfISOWeek, addDays, parseISO, isValid } from 'date-fns'
import { User, CheckCircle2, FileText } from 'lucide-react'
import { AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { useScheduleWeek } from '@/features/schedule/hooks/use-schedule-week'
import { useScheduleSlots } from '@/features/schedule/hooks/use-schedule-slots'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ROUTES } from '@/lib/routes'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'
import type { DailyReport } from '@/features/daily-report/services/daily-report.service'
import { getTimeRange } from '@/features/analytics/utils/analytics.utils'
import { useSelfWeekHours } from '../hooks/use-self-week-hours'
import { useTeamAvgCommitment } from '../hooks/use-team-avg-commitment'
import { useSelfSparkline } from '../hooks/use-self-sparkline'
import { useSelfStreak } from '../hooks/use-self-streak'
import { DashboardService } from '../services/dashboard.service'
import { TeamScheduleHeatmap } from './TeamScheduleHeatmap'
import { calcCommitmentRate } from '../utils/dashboard.utils'
import { PageContainer } from '@/components/layout/page-container'

// ── Sparkline chart config ─────────────────────────────────────────────────────

const sparklineConfig = {
  actual: {
    label: 'Giờ thực tế',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, isLoading }: { label: string; value: string; isLoading?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className="text-base sm:text-lg font-semibold break-words leading-snug">{value}</p>
      )}
    </div>
  )
}

interface TeamComparisonPanelProps {
  myRate: number | null
  teamAvgRate: number | null
}

function TeamComparisonPanel({ myRate, teamAvgRate }: TeamComparisonPanelProps) {
  const myPct = myRate != null ? Math.round(myRate * 100) : null
  const avgPct = teamAvgRate != null ? Math.round(teamAvgRate * 100) : null

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium mb-3">So sánh với nhóm (ẩn danh)</p>
      <div className="flex items-center gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Bạn</span>
          <span className="text-base font-semibold">
            {myPct != null ? `${myPct}%` : '—'}
          </span>
        </div>
        <div className="text-muted-foreground text-sm">vs</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Trung bình nhóm</span>
          <span className="text-base font-semibold">
            {avgPct != null ? `${avgPct}%` : '—'}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Dữ liệu được tổng hợp ẩn danh — không hiển thị thông tin cá nhân.
      </p>
    </div>
  )
}

// ── WeeklySparkline — AC1 ──────────────────────────────────────────────────────

interface WeeklySparklineProps {
  weeklyData: { weekLabel: string; actual: number }[]
  isLoading: boolean
}

function WeeklySparkline({ weeklyData, isLoading }: WeeklySparklineProps) {
  // P-4: useId tránh SVG gradient id collision khi nhiều instances render cùng lúc
  const gradId = useId()

  // P-1: skeleton dùng card shell để không flash layout (h-3 label + h-20 chart = khớp card thực)
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // P-8: empty state khi user chưa có dữ liệu trong 4 tuần
  const hasData = weeklyData.some(d => d.actual > 0)

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground mb-2">Giờ báo cáo 4 tuần gần nhất</p>
      {!hasData ? (
        <p className="h-20 flex items-center justify-center text-xs text-muted-foreground">
          Chưa có dữ liệu báo cáo
        </p>
      ) : (
        <ChartContainer config={sparklineConfig} className="h-20 w-full">
          <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded border border-border bg-background px-2 py-1 text-xs shadow">
                    {String(payload[0]?.payload?.weekLabel)}: {String(payload[0]?.value)}h
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--chart-2)"
              fill={`url(#${gradId})`}
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--chart-2)' }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  )
}

// ── QuickActionCard — AC3, AC4 ─────────────────────────────────────────────────

interface QuickActionCardProps {
  todayReport: DailyReport | null | undefined
  isLoading: boolean
}

function QuickActionCard({ todayReport, isLoading }: QuickActionCardProps) {
  if (isLoading) return <Skeleton className="h-16 w-full" />

  if (todayReport) {
    // P-6: dùng parseISO + isValid để tránh crash khi submitted_at malformed
    const submittedTime = (() => {
      if (!todayReport.submitted_at) return null
      const d = parseISO(todayReport.submitted_at)
      return isValid(d) ? format(d, 'HH:mm') : null
    })()

    return (
      <div className="rounded-lg border border-border p-4 flex items-center gap-3">
        <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-medium">Đã báo cáo hôm nay</p>
          <p className="text-xs text-muted-foreground">
            {Math.round(Number(todayReport.hours_logged))}h
            {submittedTime && ` — ${submittedTime}`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText className="size-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">Chưa báo cáo hôm nay</p>
      </div>
      <Button asChild size="sm" variant="default">
        <Link to={ROUTES.app.dailyReport}>Báo cáo hôm nay</Link>
      </Button>
    </div>
  )
}

// ── SelfDashboard ─────────────────────────────────────────────────────────────

export function SelfDashboard() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // Current week — tính 1 lần khi mount, không gọi new Date() lại mỗi render
  // (tránh mismatch weekStart/weekEnd nếu component re-render qua midnight)
  const { currentWeekOf, weekStart, weekEnd } = useMemo(() => {
    const start = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
    const end = format(endOfISOWeek(new Date()), 'yyyy-MM-dd')
    return { currentWeekOf: start, weekStart: start, weekEnd: end }
  }, [])

  // Timezone state — local override (không lưu vào profile)
  const [viewTimezone, setViewTimezone] = useState<string | null>(null)

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: userProfile } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated')
      return getUserProfile(user.id)
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  })

  const displayTimezone = viewTimezone ?? userProfile?.timezone ?? 'UTC'

  // My schedule — reuse schedule hooks
  const { data: scheduleWeek } = useScheduleWeek(currentWeekOf)
  const { data: mySlots = [], isLoading: isSlotsLoading } = useScheduleSlots(scheduleWeek?.id)

  // Members — để lấy committed_hours của mình
  const { data: members = [], isLoading: isMembersLoading } = useTenantMembers()
  const myMember: TenantMemberWithUser | undefined = members.find(m => m.user_id === user?.id)

  // Default committed hours fallback (khi myMember.committed_hours === null).
  // Chỉ enable SAU KHI members đã load xong để tránh query bắn sớm rồi bị stale.
  const { data: defaultHours = 40 } = useQuery({
    queryKey: ['tenant-default-hours', activeTenantId],
    queryFn: () => DashboardService.getDefaultCommittedHours(activeTenantId!),
    enabled: !!activeTenantId && !isMembersLoading && myMember?.committed_hours == null,
    staleTime: 10 * 60_000,
  })

  const committedHours: number = myMember?.committed_hours ?? defaultHours

  // Hours logged this week
  const { data: actualHours = 0, isLoading: isHoursLoading } = useSelfWeekHours(
    activeTenantId,
    user?.id ?? null,
    weekStart,
    weekEnd,
  )

  // Team average (anonymous comparison)
  const { data: teamAvg } = useTeamAvgCommitment(weekStart, weekEnd)
  // showComparison: member_count = số người KHÁC đã submit tuần này (exclude self)
  // Ngưỡng >= 4 đảm bảo đủ ẩn danh, không thể back-calculate individual rates
  const showComparison = (teamAvg?.member_count ?? 0) >= 4

  // Sparkline 4 tuần — AC1
  const { data: sparklineData, isLoading: isSparklineLoading } = useSelfSparkline()

  // Streak counter — AC2
  const { data: streak = 0, isLoading: isStreakLoading } = useSelfStreak()

  // Today's report — AC3, AC4
  // P-5: date tính trong queryFn (không freeze tại mount) + refetchOnWindowFocus để tránh stale sau midnight
  const { data: todayReport, isLoading: isTodayReportLoading } = useQuery({
    queryKey: [QUERY_KEYS.dailyReports, activeTenantId, user?.id, 'today'],
    queryFn: () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      return DailyReportService.getTodayReport(activeTenantId!, user!.id, today)
    },
    enabled: !!activeTenantId && !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  // ── Derived values ───────────────────────────────────────────────────────────

  const myRate = calcCommitmentRate(actualHours, committedHours)
  const commitmentLabel = myRate !== null ? `${Math.round(myRate * 100)}%` : '—'

  // Build sparkline chart data — 4 tuần, fill 0 cho tuần thiếu
  const sparkChartData = useMemo(() => {
    const weeklyHours = sparklineData?.weeklyHours ?? []
    const { startDate, endDate } = getTimeRange(4)
    const hoursMap = new Map(weeklyHours.map(w => [w.weekOf, w.actualHours]))

    const result: { weekLabel: string; actual: number }[] = []
    let current = startOfISOWeek(new Date(startDate + 'T00:00:00'))
    const end = new Date(endDate + 'T00:00:00')

    while (current <= end) {
      const weekOf = format(current, 'yyyy-MM-dd')
      result.push({
        weekLabel: format(current, 'dd/MM'),
        actual: hoursMap.get(weekOf) ?? 0,
      })
      current = addDays(current, 7)
    }
    return result
  }, [sparklineData?.weeklyHours])

  // Streak display label
  const streakLabel = streak > 0 ? `🔥 ${streak} ngày` : '—'

  const isLoading = isMembersLoading || isSlotsLoading || isHoursLoading

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <PageContainer variant='wide' className='space-y-4'>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </PageContainer>
    )
  }

  return (
    <PageContainer variant='wide' className='space-y-4'>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <User className="size-5 text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold">Bảng điều khiển</h1>
        <div className="ml-auto w-48 shrink-0">
          <TimezoneSelector value={displayTimezone} onChange={setViewTimezone} />
        </div>
      </div>

      {/* Stats row — giờ báo cáo, giờ cam kết, tỷ lệ, streak (AC2) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Giờ đã báo cáo tuần này" value={`${Math.round(Math.max(0, actualHours))}h`} />
        <StatCard label="Giờ cam kết" value={`${committedHours}h`} />
        <StatCard label="Tỷ lệ hoàn thành" value={commitmentLabel} />
        <StatCard label="Báo cáo liên tiếp" value={streakLabel} isLoading={isStreakLoading} />
      </div>

      {/* Quick action — AC3, AC4 */}
      <QuickActionCard todayReport={todayReport} isLoading={isTodayReportLoading} />

      {/* Sparkline 4 tuần — AC1 */}
      <WeeklySparkline weeklyData={sparkChartData} isLoading={isSparklineLoading} />

      {/* Anonymous comparison */}
      {showComparison && (
        <TeamComparisonPanel
          myRate={myRate}
          teamAvgRate={teamAvg?.avg_rate ?? null}
        />
      )}

      {/* My schedule heatmap */}
      <div>
        <p className="text-sm text-muted-foreground mb-2">Lịch làm việc tuần này</p>
        {mySlots.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
            Chưa có lịch làm việc tuần này.
          </div>
        ) : (
          <TeamScheduleHeatmap
            members={myMember ? [myMember] : []}
            slots={mySlots}
            weekOf={currentWeekOf}
            displayTimezone={displayTimezone}
          />
        )}
      </div>
    </PageContainer>
  )
}
