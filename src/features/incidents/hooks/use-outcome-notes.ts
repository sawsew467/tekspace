import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

export function useOutcomeNotes(incidentId: string | null, tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.incidentOutcomeNotes, incidentId, tenantId],
    queryFn:  () => IncidentService.getIncidentOutcomeNotes(incidentId!, tenantId!),
    staleTime: 30 * 1000,
    enabled:   !!incidentId && !!tenantId,
  })
}
