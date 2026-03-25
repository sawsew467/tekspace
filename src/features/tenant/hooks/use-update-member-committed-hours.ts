import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { updateMemberCommittedHours } from '@/features/tenant/services/tenant.service'

export function useUpdateMemberCommittedHours() {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      memberId,
      committedHours,
    }: {
      memberId: string
      committedHours: number | null
    }) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return updateMemberCommittedHours(memberId, activeTenantId, committedHours)
    },
    onSuccess: () => {
      toast.success('Đã cập nhật giờ cam kết')
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
      })
    },
    onError: () => {
      toast.error('Không thể cập nhật giờ cam kết. Vui lòng thử lại.')
    },
  })
}
