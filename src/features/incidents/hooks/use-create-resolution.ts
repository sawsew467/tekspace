import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateResolutionParams {
  tenantId:   string
  incidentId: string
  memberId:   string
  resolvedBy: string
  outcome:    'dismissed' | 'upheld'
  note?:      string
}

export function useCreateResolution(tenantId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateResolutionParams) =>
      IncidentService.createResolution(params),

    onSuccess: () => {
      toast.success('Incident đã được resolve')
    },

    onError: (error: { code?: string }) => {
      // 23505 = PostgreSQL unique constraint violation — incident đã được resolve rồi
      if (error?.code === '23505') {
        toast.error('Incident này đã được resolve rồi')
      } else {
        toast.error('Không thể resolve incident')
      }
    },

    onSettled: () => {
      if (tenantId) {
        // Invalidate cả incidents lẫn resolutions để re-render badge status
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.incidents, tenantId],
        })
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.incidentResolutions, tenantId],
        })
      }
    },
  })
}
