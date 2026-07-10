import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useTeamAnalytics } from '@/features/analytics/hooks/use-team-analytics'
import { useMemberTrend } from '@/features/analytics/hooks/use-member-trend'
import { TeamAnalyticsOverview } from '@/features/analytics/components/TeamAnalyticsOverview'
import { MemberTrendChart } from '@/features/analytics/components/MemberTrendChart'
import { SelfAnalyticsHistory } from '@/features/analytics/components/SelfAnalyticsHistory'
import { PeriodNavigator } from '@/components/period-navigator'
import {
  type Granularity,
  type Period,
  WORKDAYS_PER_WEEK,
  getPeriodRange,
  getPeriodCommittedMultiplier,
  getWindowRange,
  buildWeeklyChartData,
  buildDailyChartData,
  buildMonthlyChartData,
  buildYearlyChartData,
} from '@/features/analytics/utils/analytics.utils'
import { PageContainer } from '@/components/layout/page-container'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Số bucket hiển thị trên chart xu hướng cho mỗi mức gom. */
const TREND_BUCKETS: Record<Granularity, number> = {
  day: 14,
  week: 8,
  month: 6,
  year: 3,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * buildTrendChartData — chọn builder theo granularity, trả shape chung cho chart.
 * - day: dùng raw daily reports; committed/ngày = committed tuần ÷ số ngày làm việc.
 * - week: dùng committed history theo từng tuần (chính xác nhất).
 * - month/year: gom từ weekly hours; committed = số tuần × committed tuần.
 */
function buildTrendChartData(
  granularity: Granularity,
  startDate: string,
  endDate: string,
  dailyReports: { report_date: string; hours_logged: number }[],
  weeklyHours: { weekOf: string; actualHours: number }[],
  committedHistory: Parameters<typeof buildWeeklyChartData>[3],
  committedHoursPerWeek: number,
): { label: string; actual: number; committed: number }[] {
  switch (granularity) {
    case 'day':
      return buildDailyChartData(
        dailyReports,
        startDate,
        endDate,
        committedHoursPerWeek / WORKDAYS_PER_WEEK,
      )
    case 'week':
      return buildWeeklyChartData(
        weeklyHours,
        startDate,
        endDate,
        committedHistory,
        committedHoursPerWeek,
      ).map(d => ({ label: d.weekLabel, actual: d.actual, committed: d.committed }))
    case 'month':
      return buildMonthlyChartData(
        weeklyHours,
        startDate,
        endDate,
        committedHoursPerWeek,
      ).map(d => ({ label: d.monthLabel, actual: d.actual, committed: d.committed }))
    case 'year':
      return buildYearlyChartData(weeklyHours, startDate, endDate, committedHoursPerWeek)
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/analytics')({
  head: () => ({
    meta: [{ title: 'Phân tích — TekSpace' }],
  }),
  component: AnalyticsPage,
})

// ── AnalyticsPage ─────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // ── Local state ───────────────────────────────────────────────────────────

  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [teamPeriod, setTeamPeriod] = useState<Period>({ granularity: 'week', anchor: today })
  const [trendPeriod, setTrendPeriod] = useState<Period>({ granularity: 'week', anchor: today })

  // ── Date ranges ───────────────────────────────────────────────────────────

  const { start: teamStart, end: teamEnd } = getPeriodRange(teamPeriod)
  const teamCommittedMultiplier = getPeriodCommittedMultiplier(teamPeriod)
  const { start: trendStart, end: trendEnd } = getWindowRange(
    trendPeriod.granularity,
    trendPeriod.anchor,
    TREND_BUCKETS[trendPeriod.granularity],
  )

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: members = [], isLoading: isMembersLoading } = useTenantMembers()

  const { data: tenantSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getTenantSettings(activeTenantId)
    },
    enabled: !!activeTenantId,
    staleTime: 5 * 60_000,
  })

  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40

  const { data: teamHours = [], isLoading: isTeamHoursLoading } = useTeamAnalytics(
    teamStart,
    teamEnd,
  )

  const { data: trendData, isLoading: isTrendLoading } = useMemberTrend(
    selectedUserId,
    trendStart,
    trendEnd,
  )
  const memberWeeklyHours = trendData?.weeklyHours ?? []
  const memberCommittedHistory = trendData?.committedHistory ?? []
  const memberDailyReports = trendData?.dailyReports ?? []

  // ── Derived data ──────────────────────────────────────────────────────────

  // Build hoursMap for team overview table
  const hoursMap = new Map(teamHours.map(r => [r.userId, r.totalHours]))

  // Selected member details
  const selectedMember = members.find(m => m.user_id === selectedUserId) ?? null
  const selectedMemberName = selectedMember
    ? selectedMember.users?.full_name ||
      (selectedMember.users?.email
        ? selectedMember.users.email.split('@')[0]
        : 'Member')
    : null
  const selectedMemberCommitted =
    selectedMember?.committed_hours ?? defaultCommittedHours

  // Build chart data for trend section theo mức gom — chờ settings load để tránh flicker.
  // Chuẩn hóa mọi builder về shape chung { label, actual, committed }.
  const chartData: { label: string; actual: number; committed: number }[] =
    selectedUserId && !isSettingsLoading
      ? buildTrendChartData(
          trendPeriod.granularity,
          trendStart,
          trendEnd,
          memberDailyReports,
          memberWeeklyHours,
          memberCommittedHistory,
          selectedMemberCommitted,
        )
      : []

  // ── Permission check ──────────────────────────────────────────────────────

  const myMember = members.find(m => m.user_id === user?.id)
  const canViewTeamAnalytics =
    myMember?.role === 'owner' || myMember?.role === 'manager'

  // ── Loading state ─────────────────────────────────────────────────────────

  const isPageLoading = isMembersLoading || isSettingsLoading

  if (isPageLoading) {
    return (
      <PageContainer variant='wide' className='space-y-4'>
        <Skeleton className="h-7 w-40" />
        <div className="space-y-2 rounded-lg border border-border p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </PageContainer>
    )
  }

  // ── Permission gate: member thấy self-analytics thay vì "no access" ─────────

  if (!canViewTeamAnalytics) {
    return <SelfAnalyticsHistory />
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer variant='wide' className='space-y-6'>
      {/* Page header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold">Phân tích</h1>
      </div>

      {/* Team Overview table (AC1) */}
      <section aria-label="Team hours overview">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tổng quan nhóm
          </h2>
          <PeriodNavigator period={teamPeriod} onChange={setTeamPeriod} />
        </div>
        <TeamAnalyticsOverview
          members={members}
          hoursMap={hoursMap}
          defaultCommittedHours={defaultCommittedHours}
          committedMultiplier={teamCommittedMultiplier}
          isLoading={isTeamHoursLoading}
          selectedUserId={selectedUserId}
          onSelectMember={userId => {
            setSelectedUserId(prev => (prev === userId ? null : userId))
          }}
        />
      </section>

      {/* Per-member drill-down (AC2) */}
      {selectedUserId && selectedMemberName && (
        <section aria-label={`${selectedMemberName} trend chart`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Xu hướng — {selectedMemberName}
            </h2>
            <PeriodNavigator period={trendPeriod} onChange={setTrendPeriod} />
          </div>
          <MemberTrendChart
            memberName={selectedMemberName}
            chartData={chartData}
            granularity={trendPeriod.granularity}
            isLoading={isTrendLoading || isSettingsLoading}
          />
        </section>
      )}
    </PageContainer>
  )
}
