import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useAppeals(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
    queryFn: () => IncidentService.getIncidentAppeals(tenantId!),
    staleTime: 30 * 1000,
    enabled: !!tenantId,
  })
}
