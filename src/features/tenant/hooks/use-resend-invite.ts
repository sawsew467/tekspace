import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { resendInvite } from '@/features/tenant/services/tenant.service'

export function useResendInvite() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()

  return useMutation({
    mutationFn: ({ inviteId, email }: { inviteId: string; email: string }) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return resendInvite(inviteId, activeTenantId, email)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantInvites, activeTenantId] })
    },
  })
}
