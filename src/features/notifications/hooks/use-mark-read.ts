import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService, type Notification } from '@/features/notifications/services/notifications.service'

export function useMarkRead(tenantId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const listKey = [QUERY_KEYS.notifications, tenantId, userId]
  const countKey = [QUERY_KEYS.notifications, tenantId, userId, 'unread-count']

  return useMutation({
    mutationFn: (notificationId: string) =>
      NotificationsService.markAsRead(notificationId),

    onMutate: async (notificationId) => {
      // Cancel in-flight queries để tránh race condition
      await queryClient.cancelQueries({ queryKey: listKey })
      await queryClient.cancelQueries({ queryKey: countKey })

      const listSnapshot = queryClient.getQueryData<Notification[]>(listKey)
      const countSnapshot = queryClient.getQueryData<number>(countKey)

      // F8: Chỉ update cache nếu list đã load — tránh set thành [] rồi rollback bị skip
      if (listSnapshot) {
        const wasUnread = listSnapshot.find((n) => n.id === notificationId)?.is_read === false

        queryClient.setQueryData<Notification[]>(listKey, (old) =>
          old?.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        )

        // F5: Sync unread-count ngay lập tức để badge không lag
        if (wasUnread && countSnapshot !== undefined) {
          queryClient.setQueryData<number>(countKey, (old) =>
            Math.max(0, (old ?? 0) - 1)
          )
        }
      }

      return { listSnapshot, countSnapshot }
    },

    onError: (_err, _id, context) => {
      // Rollback cả list lẫn count về snapshot trước mutation
      if (context?.listSnapshot !== undefined) {
        queryClient.setQueryData(listKey, context.listSnapshot)
      }
      if (context?.countSnapshot !== undefined) {
        queryClient.setQueryData(countKey, context.countSnapshot)
      }
      toast.error('Không thể cập nhật thông báo')
    },

    // P7: Guard tenantId null trước khi invalidate
    onSettled: () => {
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.notifications, tenantId],
        })
      }
    },
  })
}
