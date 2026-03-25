import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'
import { groupReportsByWeek } from '@/features/analytics/utils/analytics.utils'
import type {
  WeeklyHoursRow,
  CommittedHoursHistoryRow,
} from '@/features/analytics/services/analytics.service'

export type MemberTrendData = {
  weeklyHours: WeeklyHoursRow[]
  committedHistory: CommittedHoursHistoryRow[]
}

/**
 * useMemberTrend — lấy weekly hours VÀ committed hours history của một member.
 * Fetch song song 2 queries để tối ưu latency.
 * Disabled khi userId chưa được chọn.
 * staleTime 2 phút.
 */
export function useMemberTrend(
  userId: string | null,
  startDate: string,
  endDate: string,
): ReturnType<typeof useQuery<MemberTrendData>> {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'member-trend', activeTenantId, userId, startDate, endDate],
    queryFn: async (): Promise<MemberTrendData> => {
      const [reports, history] = await Promise.all([
        AnalyticsService.getMemberReportsForPeriod(
          activeTenantId!,
          userId!,
          startDate,
          endDate,
        ),
        AnalyticsService.getMemberCommittedHoursHistory(
          activeTenantId!,
          userId!,
          startDate,
          endDate,
        ),
      ])
      return {
        weeklyHours: groupReportsByWeek(reports),
        committedHistory: history,
      }
    },
    enabled: !!activeTenantId && !!userId && !!startDate && !!endDate,
    staleTime: 2 * 60_000,
  })
}
