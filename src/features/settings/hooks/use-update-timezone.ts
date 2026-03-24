import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { updateTimezone } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'

export const useUpdateTimezone = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (timezone: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      return updateTimezone(user.id, timezone)
    },
    onSuccess: () => {
      toast.success('Đã lưu timezone')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.userProfile, user?.id] })
    },
    onError: () => {
      toast.error('Không thể lưu timezone. Vui lòng thử lại.')
    },
  })
}
