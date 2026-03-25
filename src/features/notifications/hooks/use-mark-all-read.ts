import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService, type Notification } from '@/features/notifications/services/notifications.service'

export function useMarkAllRead(tenantId: string | null, userId: string | null) {
  const queryClient = useQueryClient()
  const listKey = [QUERY_KEYS.notifications, tenantId, userId]
  const infiniteKey = [QUERY_KEYS.notifications, tenantId, userId, 'infinite']
  const countKey = [QUERY_KEYS.notifications, tenantId, userId, 'unread-count']

  return useMutation({
    // P4: Guard null trước khi gọi service — tránh crash non-null assertion
    mutationFn: () => {
      if (!tenantId || !userId) throw new Error('tenantId và userId là bắt buộc')
      return NotificationsService.markAllAsRead(tenantId, userId)
    },

    // F6: Optimistic UI — cập nhật cache ngay để không bị lag sau khi click
    onMutate: async () => {
      if (!tenantId || !userId) return

      await queryClient.cancelQueries({ queryKey: listKey })
      await queryClient.cancelQueries({ queryKey: infiniteKey })
      await queryClient.cancelQueries({ queryKey: countKey })

      const listSnapshot = queryClient.getQueryData<Notification[]>(listKey)
      const infiniteSnapshot = queryClient.getQueryData<InfiniteData<Notification[]>>(infiniteKey)
      const countSnapshot = queryClient.getQueryData<number>(countKey)

      // Mark tất cả items trong list thành read
      queryClient.setQueryData<Notification[]>(listKey, (old) =>
        old?.map((n) => ({ ...n, is_read: true }))
      )
      // Reset unread count về 0
      queryClient.setQueryData<number>(countKey, 0)

      // P-2: Optimistic update cho infinite query
      if (infiniteSnapshot) {
        queryClient.setQueryData<InfiniteData<Notification[]>>(infiniteKey, (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((n) => ({ ...n, is_read: true }))
            ),
          }
        })
      }

      return { listSnapshot, infiniteSnapshot, countSnapshot }
    },

    onError: (_err, _vars, context) => {
      // Rollback cả list lẫn count về snapshot trước mutation
      if (context?.listSnapshot !== undefined) {
        queryClient.setQueryData(listKey, context.listSnapshot)
      }
      if (context?.infiniteSnapshot !== undefined) {
        queryClient.setQueryData(infiniteKey, context.infiniteSnapshot)
      }
      if (context?.countSnapshot !== undefined) {
        queryClient.setQueryData(countKey, context.countSnapshot)
      }
      toast.error('Không thể cập nhật thông báo')
    },

    onSuccess: () => {
      toast.success('Đã đánh dấu tất cả đã đọc')
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
