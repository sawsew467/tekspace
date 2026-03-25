import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateAppealParams {
  tenantId: string
  incidentId: string
  memberId: string
  response: string
}

export function useCreateAppeal(tenantId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateAppealParams) =>
      IncidentService.createAppeal(params),

    onSuccess: () => {
      toast.success('Appeal đã được gửi thành công')
    },

    onError: (error: Error) => {
      // Dùng Postgres error code '23505' (unique_violation) — stable hơn string matching
      const pgCode = (error as unknown as { code?: string }).code
      const isUniqueViolation =
        pgCode === '23505' ||
        error.message?.includes('duplicate') ||
        error.message?.includes('unique')
      if (isUniqueViolation) {
        toast.error('Bạn đã gửi appeal cho incident này rồi')
      } else {
        toast.error('Không thể gửi appeal')
      }
    },

    onSettled: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
        })
      }
    },
  })
}
