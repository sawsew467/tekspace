import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

const PAGE_SIZE = 20

export function useInfiniteReports(tenantId: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, type: 'history-infinite' }],
    queryFn: ({ pageParam }) =>
      DailyReportService.getAllReportsPaged(
        tenantId!,
        userId!,
        pageParam,
        pageParam + PAGE_SIZE - 1,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 60_000,
    enabled: !!tenantId && !!userId,
  })
}
