import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateIncidentParams {
  tenantId: string
  memberId: string
  managerId: string
  category: string
  note: string
}

export function useCreateIncident(tenantId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateIncidentParams) =>
      IncidentService.createIncident(params),

    onSuccess: () => {
      toast.success('Incident đã được ghi nhận')
    },

    onError: () => {
      toast.error('Không thể ghi nhận incident')
    },

    onSettled: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.incidents, tenantId],
        })
      }
    },
  })
}
