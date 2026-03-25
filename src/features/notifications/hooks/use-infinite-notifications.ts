import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService } from '@/features/notifications/services/notifications.service'

const PAGE_SIZE = 20

export function useInfiniteNotifications(tenantId: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.notifications, tenantId, userId, 'infinite'],
    queryFn: ({ pageParam }) =>
      NotificationsService.getNotificationsPaged(
        tenantId!,
        userId!,
        pageParam,
        pageParam + PAGE_SIZE - 1,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 30_000,
    enabled: !!tenantId && !!userId,
  })
}
