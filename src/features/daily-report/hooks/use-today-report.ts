import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

export function useTodayReport(tenantId: string | null, userId: string | null, reportDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, date: reportDate }],
    queryFn: () => DailyReportService.getTodayReport(tenantId!, userId!, reportDate),
    // staleTime: 0 — report hôm nay có thể vừa submit, cần fetch mới nhất
    staleTime: 0,
    enabled: !!tenantId && !!userId && !!reportDate,
  })
}
