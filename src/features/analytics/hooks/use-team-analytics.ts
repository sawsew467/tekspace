import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'

/**
 * useTeamAnalytics — lấy tổng hours của từng member trong một khoảng tuần.
 * Dùng cho team overview table.
 * staleTime 2 phút — analytics ít thay đổi realtime.
 */
export function useTeamAnalytics(weekStart: string, weekEnd: string) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'team-overview', activeTenantId, weekStart, weekEnd],
    queryFn: () =>
      AnalyticsService.getTeamHoursForPeriod(activeTenantId!, weekStart, weekEnd),
    enabled: !!activeTenantId && !!weekStart,
    staleTime: 2 * 60_000,
  })
}
