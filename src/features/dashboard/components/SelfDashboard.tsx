import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns'
import { User } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { useScheduleWeek } from '@/features/schedule/hooks/use-schedule-week'
import { useScheduleSlots } from '@/features/schedule/hooks/use-schedule-slots'
import { QUERY_KEYS } from '@/lib/query-keys'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { useSelfWeekHours } from '../hooks/use-self-week-hours'
import { useTeamAvgCommitment } from '../hooks/use-team-avg-commitment'
import { DashboardService } from '../services/dashboard.service'
import { TeamScheduleHeatmap } from './TeamScheduleHeatmap'
import { calcCommitmentRate, formatCommitmentRate } from '../utils/dashboard.utils'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, isLoading }: { label: string; value: string; isLoading?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className="text-lg font-semibold">{value}</p>
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

  // ── Derived values ───────────────────────────────────────────────────────────

  const myRate = calcCommitmentRate(actualHours, committedHours)
  const commitmentLabel = formatCommitmentRate(actualHours, committedHours)

  const isLoading = isMembersLoading || isSlotsLoading || isHoursLoading

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <User className="size-5 text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold">My Dashboard</h1>
        <div className="ml-auto w-48 shrink-0">
          <TimezoneSelector value={displayTimezone} onChange={setViewTimezone} />
        </div>
      </div>

      {/* Stats row — AC2, AC3 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Giờ đã báo cáo tuần này" value={`${Math.round(Math.max(0, actualHours))}h`} />
        <StatCard label="Giờ cam kết" value={`${committedHours}h`} />
        <StatCard label="Tỷ lệ hoàn thành" value={commitmentLabel} />
      </div>

      {/* Anonymous comparison — AC4, AC5 */}
      {showComparison && (
        <TeamComparisonPanel
          myRate={myRate}
          teamAvgRate={teamAvg?.avg_rate ?? null}
        />
      )}

      {/* My schedule heatmap — AC1 */}
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
    </div>
  )
}
