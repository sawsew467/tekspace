import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { demoteToMember } from '@/features/tenant/services/tenant.service'

export function useDemoteMember() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return demoteToMember(userId, activeTenantId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantMembers, activeTenantId] })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Không thể hạ quyền thành viên. Vui lòng thử lại.'
      toast.error(message)
    },
  })
}
