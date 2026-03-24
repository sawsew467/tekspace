import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService } from '@/features/notifications/services/notifications.service'

export function useUnreadCount(tenantId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.notifications, tenantId, userId, 'unread-count'],
    queryFn: () => NotificationsService.getUnreadCount(tenantId!, userId!),
    staleTime: 0,
    enabled: !!tenantId && !!userId,
  })
}
