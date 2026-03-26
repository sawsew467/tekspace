import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfISOWeek, format, parseISO, addDays } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { QUERY_KEYS } from '@/lib/query-keys'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { useTeamWeekSlots } from '../hooks/use-team-week-slots'
import { TeamScheduleHeatmap } from './TeamScheduleHeatmap'
import { getOnlineMemberIds, getInitials } from '../utils/dashboard.utils'
import { PageContainer } from '@/components/layout/page-container'

function getCurrentWeekOf(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
}

export function TeamDashboard() {
  const { user } = useAuthStore()

  // ── Week navigation state ─────────────────────────────────────────────────
  const [currentWeekOf, setCurrentWeekOf] = useState(getCurrentWeekOf)
  const isViewingCurrentWeek = currentWeekOf === getCurrentWeekOf()

  const handlePrevWeek = () =>
    setCurrentWeekOf(prev => format(addDays(parseISO(prev), -7), 'yyyy-MM-dd'))
  const handleNextWeek = () =>
    setCurrentWeekOf(prev => format(addDays(parseISO(prev), 7), 'yyyy-MM-dd'))
  const handleGoToCurrentWeek = () => setCurrentWeekOf(getCurrentWeekOf())

  // ── Timezone state — local override (không lưu vào profile) ──────────────
  const [viewTimezone, setViewTimezone] = useState<string | null>(null)

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: userProfile } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => {
      if (!user?.id) throw new Error('User not authenticated')
      return getUserProfile(user.id)
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // displayTimezone: user manual override → profile timezone → UTC fallback
  const displayTimezone = viewTimezone ?? userProfile?.timezone ?? 'UTC'

  const { data: members = [], isLoading: isMembersLoading, isError: isMembersError } = useTenantMembers()

  // refetchInterval: 60s khi xem tuần hiện tại để "who is online" tự refresh
  const { data: slots = [], isLoading: isSlotsLoading } = useTeamWeekSlots(
    currentWeekOf,
    { refetchInterval: isViewingCurrentWeek ? 60_000 : undefined },
  )

  const isLoading = isMembersLoading || isSlotsLoading

  // ── Online members — client-side, pure UTC computation ────────────────────
  const onlineMemberIds = isViewingCurrentWeek ? getOnlineMemberIds(slots) : []
  const onlineMembers = members
    .filter(m => onlineMemberIds.includes(m.user_id))
    .sort((a, b) => a.users.full_name.localeCompare(b.users.full_name))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer variant='wide' className='flex flex-col gap-4'>
      {/* Header: title + week nav + timezone selector — 1 dòng */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
        <h1 className="text-xl font-semibold shrink-0">Team Schedule</h1>

        {/* Week navigation — căn giữa */}
        <div className="flex items-center gap-1 mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevWeek}
            aria-label="Tuần trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums px-2">
            {format(parseISO(currentWeekOf), 'dd/MM')}
            {' – '}
            {format(addDays(parseISO(currentWeekOf), 6), 'dd/MM/yyyy')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextWeek}
            aria-label="Tuần sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isViewingCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700"
              onClick={handleGoToCurrentWeek}
            >
              Tuần này
            </Button>
          )}
        </div>

        {/* Timezone selector — bên phải */}
        <div className="w-48 shrink-0">
          <TimezoneSelector
            value={displayTimezone}
            onChange={(tz) => {
              if (tz === userProfile?.timezone) setViewTimezone(null)
              else setViewTimezone(tz)
            }}
          />
        </div>
      </div>

      {/* Online Now Panel — chỉ hiển thị khi xem tuần hiện tại */}
      {isViewingCurrentWeek && !isLoading && !isMembersError && (
        <OnlineNowPanel onlineMembers={onlineMembers} />
      )}

      {/* Legend */}
      {!isLoading && members.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground justify-end pr-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border border-border/40" /> 1 người
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-border/40" /> 2 người
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-200 border border-border/40" /> 3 người
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-300 border border-border/40" /> 4+
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <TeamDashboardSkeleton />
      ) : members.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Chưa có thành viên nào trong team.
        </div>
      ) : (
        <TeamScheduleHeatmap
          members={members}
          slots={slots}
          weekOf={currentWeekOf}
          displayTimezone={displayTimezone}
          isCurrentWeek={isViewingCurrentWeek}
        />
      )}
    </PageContainer>
  )
}

// ── Online Now Panel ──────────────────────────────────────────────────────────

function OnlineNowPanel({ onlineMembers }: { onlineMembers: TenantMemberWithUser[] }) {
  const isAnyoneOnline = onlineMembers.length > 0
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        {/* P6: pulsing dot only when someone is online */}
        {isAnyoneOnline ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        ) : (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
          </span>
        )}
        <span className="text-sm font-medium">Đang online ({onlineMembers.length})</span>
      </div>
      {onlineMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có ai đang trong giờ làm việc.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {onlineMembers.map((m) => (
            <div key={m.user_id} className="flex items-center gap-1.5 text-sm">
              <span className="inline-flex size-6 rounded-full bg-muted items-center justify-center text-xs font-medium">
                {getInitials(m.users.full_name)}
              </span>
              <span>{m.users.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TeamDashboardSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/40">
            <th className="border border-border/40 py-2 px-2 w-16">
              <Skeleton className="h-3 w-8" />
            </th>
            {Array.from({ length: 7 }).map((_, i) => (
              <th key={i} className="border border-border/40 py-2 px-1">
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-6" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="border border-border/40 py-1 px-2 bg-muted/20">
                <Skeleton className="h-3 w-10" />
              </td>
              {Array.from({ length: 7 }).map((_, j) => (
                <td key={j} className="border border-border/40 h-10">
                  {(i + j) % 4 === 0 && (
                    <div className="flex gap-0.5 justify-center p-1">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="size-6 rounded-full" />
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
