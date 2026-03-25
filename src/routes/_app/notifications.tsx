import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { useInfiniteNotifications } from '@/features/notifications/hooks/use-infinite-notifications'
import { useUnreadCount } from '@/features/notifications/hooks/use-unread-count'
import { useMarkRead } from '@/features/notifications/hooks/use-mark-read'
import { useMarkAllRead } from '@/features/notifications/hooks/use-mark-all-read'
import { NotificationList } from '@/features/notifications/components/NotificationList'
import { PageContainer } from '@/components/layout/page-container'

// Validate timezone string để tránh RangeError
function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const Route = createFileRoute('/_app/notifications')({
  head: () => ({
    meta: [{ title: 'Thông báo — TekSpace' }],
  }),
  component: NotificationsPage,
})

function NotificationsPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // User profile để lấy timezone
  // P11: isLoading dùng để defer tooltip — tránh tooltip nhảy từ UTC → real timezone
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // P11: Trả về null khi đang load để NotificationItem ẩn tooltip hoàn toàn
  // (tránh tooltip hiển thị UTC rồi nhảy sang timezone thực của user)
  const timezone = useMemo((): string | null => {
    if (isProfileLoading) return null
    const raw = userProfile?.timezone
    return isValidTimezone(raw) ? raw : 'UTC'
  }, [userProfile?.timezone, isProfileLoading])

  const {
    data: notificationsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteNotifications(activeTenantId, user?.id ?? null)

  const notifications = useMemo(
    () => notificationsData?.pages.flatMap((p) => p) ?? [],
    [notificationsData?.pages],
  )

  // P1: Truyền thêm userId để useMarkRead có thể làm optimistic update đúng queryKey
  const markRead = useMarkRead(activeTenantId, user?.id ?? null)
  const markAllRead = useMarkAllRead(activeTenantId, user?.id ?? null)

  // F9: Dùng useUnreadCount thay vì notifications.some() để hasUnread đúng khi >50 items
  const { data: unreadCount = 0 } = useUnreadCount(activeTenantId, user?.id ?? null)
  const hasUnread = unreadCount > 0

  return (
    <PageContainer className='space-y-4'>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Thông báo</h1>
        </div>
        {/* P5: Luôn render button, disabled khi không có unread (thay vì ẩn hoàn toàn) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={!hasUnread || markAllRead.isPending}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      {/* Notification list */}
      <NotificationList
        notifications={notifications}
        userTimezone={timezone}
        isLoading={isLoading}
        onMarkRead={(id) => markRead.mutate(id)}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </PageContainer>
  )
}
