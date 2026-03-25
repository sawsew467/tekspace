import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

/**
 * useSelfWeekHours — tổng hours_logged của member trong tuần hiện tại.
 * Dùng trong Self-Dashboard (Story 3.3).
 * staleTime 60s — report có thể thay đổi trong ngày (submit/update).
 */
export function useSelfWeekHours(
  tenantId: string | null,
  userId: string | null,
  weekStart: string,
  weekEnd: string,
) {
  return useQuery({
    queryKey: [QUERY_KEYS.selfWeekHours, tenantId, userId, weekStart, weekEnd],
    queryFn: () => DailyReportService.getSelfWeekHours(tenantId!, userId!, weekStart, weekEnd),
    enabled: !!tenantId && !!userId && !!weekStart,
    staleTime: 60_000,
  })
}
