import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { removeMember } from '@/features/tenant/services/tenant.service'

export function useRemoveMember() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()

  return useMutation({
    mutationFn: (userId: string) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return removeMember(userId, activeTenantId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantMembers, activeTenantId] })
    },
    // P14: safety net — hiển thị lỗi nếu call site quên try/catch
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Không thể xóa thành viên. Vui lòng thử lại.'
      toast.error(message)
    },
  })
}
