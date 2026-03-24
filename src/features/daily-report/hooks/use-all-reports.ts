import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

/**
 * Lấy toàn bộ history reports của user.
 * enabled chỉ khi cả tenantId và userId đều có giá trị.
 * staleTime 60s — history ít thay đổi.
 */
export function useAllReports(tenantId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, type: 'history' }],
    queryFn: () => {
      if (!tenantId || !userId) return Promise.resolve([])
      return DailyReportService.getAllReports(tenantId, userId)
    },
    enabled: !!tenantId && !!userId,
    staleTime: 60_000,
  })
}
