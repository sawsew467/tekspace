import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { useAuthStore } from '@/stores/auth-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { transferOwnership } from '@/features/tenant/services/tenant.service'

export function useTransferOwnership() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: (newOwnerId: string) => {
      if (!activeTenantId) throw new Error('No active tenant')
      if (!user?.id) throw new Error('Not authenticated')
      return transferOwnership(newOwnerId, activeTenantId, user.id)
    },
    onSuccess: () => {
      // Invalidate members + tenant settings (role change affects tenant context)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantMembers, activeTenantId] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantSettings, activeTenantId] })
    },
    // P14: safety net — hiển thị lỗi nếu call site quên try/catch
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Không thể chuyển quyền Owner. Vui lòng thử lại.'
      toast.error(message)
    },
  })
}
