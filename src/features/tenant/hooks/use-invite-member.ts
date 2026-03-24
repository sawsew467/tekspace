import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { inviteMember } from '@/features/tenant/services/tenant.service'
import { toast } from 'sonner'

export function useInviteMember() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()

  return useMutation({
    mutationFn: (email: string) => {
      if (!activeTenantId) throw new Error('No active tenant')
      return inviteMember(activeTenantId, email)
    },
    onSuccess: () => {
      // onSuccess toast xử lý ở component (cần hiển thị link)
      // chỉ invalidate query ở đây
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantInvites] })
    },
    onError: (error: Error) => {
      // P12: service đã extract user-facing message, hiển thị trực tiếp
      toast.error(error.message || 'Không thể gửi lời mời. Vui lòng thử lại.')
    },
  })
}
