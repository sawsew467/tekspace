import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfISOWeek, format, parseISO, addDays } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useTeamWeekSlots } from '../hooks/use-team-week-slots'
import { TeamScheduleHeatmap } from './TeamScheduleHeatmap'

function getCurrentWeekOf(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
}

export function TeamDashboard() {
  const { user } = useAuthStore()

  // ── Week navigation state ─────────────────────────────────────────────────
  const [currentWeekOf, setCurrentWeekOf] = useState(getCurrentWeekOf)
  const todayWeekOf = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
  const isViewingCurrentWeek = currentWeekOf === todayWeekOf

  const handlePrevWeek = () =>
    setCurrentWeekOf(prev => format(addDays(parseISO(prev), -7), 'yyyy-MM-dd'))
  const handleNextWeek = () =>
    setCurrentWeekOf(prev => format(addDays(parseISO(prev), 7), 'yyyy-MM-dd'))
  const handleGoToCurrentWeek = () => setCurrentWeekOf(getCurrentWeekOf())

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
  const displayTimezone = userProfile?.timezone ?? 'UTC'

  const { data: members = [], isLoading: isMembersLoading } = useTenantMembers()
  const { data: slots = [], isLoading: isSlotsLoading } = useTeamWeekSlots(currentWeekOf)

  const isLoading = isMembersLoading || isSlotsLoading

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Team Dashboard</h1>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-1">
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
        />
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
