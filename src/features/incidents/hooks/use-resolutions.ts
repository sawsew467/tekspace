import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useResolutions(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentResolutions, tenantId],
    queryFn: () => IncidentService.getResolutions(tenantId!),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    enabled: !!tenantId,
  })
}
