import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getMembers } from '@/features/tenant/services/tenant.service'

export function useTenantMembers() {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getMembers(activeTenantId)
    },
    enabled: !!activeTenantId,
  })
}
