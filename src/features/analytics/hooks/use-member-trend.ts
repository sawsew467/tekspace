import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import {
  AnalyticsService,
  type WeeklyHoursRow,
  type CommittedHoursHistoryRow,
} from '@/features/analytics/services/analytics.service'
import { groupReportsByWeek } from '@/features/analytics/utils/analytics.utils'

export type MemberTrendData = {
  weeklyHours: WeeklyHoursRow[]
  committedHistory: CommittedHoursHistoryRow[]
  dailyReports: { report_date: string; hours_logged: number }[]
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
        dailyReports: reports,
      }
    },
    enabled: !!activeTenantId && !!userId && !!startDate && !!endDate,
    staleTime: 2 * 60_000,
  })
}
