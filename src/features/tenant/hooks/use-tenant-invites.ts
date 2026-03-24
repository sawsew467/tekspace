import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getInvites } from '@/features/tenant/services/tenant.service'

export function useTenantInvites() {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.tenantInvites, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getInvites(activeTenantId)
    },
    enabled: !!activeTenantId,
  })
}
