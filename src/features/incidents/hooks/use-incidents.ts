import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useIncidents(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidents, tenantId],
    queryFn: () => IncidentService.getIncidents(tenantId!),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    enabled: !!tenantId,
  })
}
