import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

/**
 * Lấy danh sách report_date của user — lightweight, dùng cho streak computation.
 * Eager-fetched ngay khi load trang (không lazy).
 * staleTime 60s — đủ để tránh refetch liên tục, invalidated khi submit report.
 */
export function useReportDates(tenantId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, type: 'dates' }],
    queryFn: () => {
      if (!tenantId || !userId) return Promise.resolve([])
      return DailyReportService.getReportDates(tenantId, userId)
    },
    enabled: !!tenantId && !!userId,
    staleTime: 60_000,
  })
}
