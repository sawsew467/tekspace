import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

interface CreateOutcomeNoteParams {
  tenantId:   string
  incidentId: string
  managerId:  string
  memberId:   string
  note:       string
}

export function useCreateOutcomeNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateOutcomeNoteParams) =>
      IncidentService.createOutcomeNote(params),

    onSuccess: () => {
      toast.success('Ghi chú đã được thêm')
    },

    onError: () => {
      toast.error('Không thể thêm ghi chú')
    },

    onSettled: (_data, _err, variables) => {
      // Dùng variables.tenantId thay vì closure để tránh cache miss khi tenantId chưa load
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.incidentOutcomeNotes, variables.incidentId, variables.tenantId],
      })
    },
  })
}
