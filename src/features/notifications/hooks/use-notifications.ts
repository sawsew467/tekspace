import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService } from '@/features/notifications/services/notifications.service'

export function useNotifications(tenantId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.notifications, tenantId, userId],
    queryFn: () => NotificationsService.getNotifications(tenantId!, userId!),
    staleTime: 30 * 1000,
    enabled: !!tenantId && !!userId,
  })
}
