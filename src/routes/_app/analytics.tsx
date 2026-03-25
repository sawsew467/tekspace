import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  getCurrentWeekRange,
  getTimeRange,
  buildWeeklyChartData,
} from '@/features/analytics/utils/analytics.utils'
import { PageContainer } from '@/components/layout/page-container'

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
] as const

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/analytics')({
  head: () => ({
    meta: [{ title: 'Analytics — TekSpace' }],
  }),
  component: AnalyticsPage,
})

// ── AnalyticsPage ─────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // ── Local state ───────────────────────────────────────────────────────────

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)

  // ── Date ranges ───────────────────────────────────────────────────────────

  const { weekStart, weekEnd } = getCurrentWeekRange()
  const { startDate: trendStart, endDate: trendEnd } = getTimeRange(rangeWeeks)

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
    weekStart,
    weekEnd,
  )

  const { data: trendData, isLoading: isTrendLoading } = useMemberTrend(
    selectedUserId,
    trendStart,
    trendEnd,
  )
  const memberWeeklyHours = trendData?.weeklyHours ?? []
  const memberCommittedHistory = trendData?.committedHistory ?? []

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

  // Build chart data for trend section — chờ settings load để tránh flicker
  const chartData = selectedUserId && !isSettingsLoading
    ? buildWeeklyChartData(
        memberWeeklyHours,
        trendStart,
        trendEnd,
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
        <h1 className="text-lg font-semibold">Analytics</h1>
        <span className="text-xs text-muted-foreground ml-1">
          Tuần {format(new Date(weekStart + 'T00:00:00'), 'dd/MM')}–
          {format(new Date(weekEnd + 'T00:00:00'), 'dd/MM/yyyy')}
        </span>
      </div>

      {/* Team Overview table (AC1) */}
      <section aria-label="Team hours overview">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Team Overview — Tuần này
        </h2>
        <TeamAnalyticsOverview
          members={members}
          hoursMap={hoursMap}
          defaultCommittedHours={defaultCommittedHours}
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Trend — {selectedMemberName}
            </h2>
            <Select
              value={String(rangeWeeks)}
              onValueChange={v => setRangeWeeks(Number(v))}
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <MemberTrendChart
            memberName={selectedMemberName}
            chartData={chartData}
            weeklyHours={memberWeeklyHours}
            committedHoursPerWeek={selectedMemberCommitted}
            isLoading={isTrendLoading || isSettingsLoading}
          />
        </section>
      )}
    </PageContainer>
  )
}
