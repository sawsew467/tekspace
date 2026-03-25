import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

const PAGE_SIZE = 20

export function useInfiniteIncidents(tenantId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.incidents, tenantId, 'infinite'],
    queryFn: ({ pageParam }) =>
      IncidentService.getIncidentsPaged(
        tenantId!,
        pageParam,
        pageParam + PAGE_SIZE - 1,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 30_000,
    enabled: !!tenantId,
  })
}
