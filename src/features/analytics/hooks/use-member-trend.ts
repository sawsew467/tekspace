import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'
import { groupReportsByWeek } from '@/features/analytics/utils/analytics.utils'
import type { WeeklyHoursRow } from '@/features/analytics/services/analytics.service'

/**
 * useMemberTrend — lấy weekly hours của một member trong range đã chọn.
 * Disabled khi userId chưa được chọn.
 * staleTime 2 phút.
 */
export function useMemberTrend(
  userId: string | null,
  startDate: string,
  endDate: string,
): ReturnType<typeof useQuery<WeeklyHoursRow[]>> {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'member-trend', activeTenantId, userId, startDate, endDate],
    queryFn: async (): Promise<WeeklyHoursRow[]> => {
      const reports = await AnalyticsService.getMemberReportsForPeriod(
        activeTenantId!,
        userId!,
        startDate,
        endDate,
      )
      return groupReportsByWeek(reports)
    },
    enabled: !!activeTenantId && !!userId && !!startDate,
    staleTime: 2 * 60_000,
  })
}
