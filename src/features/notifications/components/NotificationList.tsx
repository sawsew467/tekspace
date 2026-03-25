import { useRef, useEffect } from 'react'
import { BellOff, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import type { Notification } from '@/features/notifications/services/notifications.service'

type NotificationListProps = {
  notifications: Notification[]
  userTimezone: string | null // null khi timezone chưa load — tooltip sẽ ẩn
  isLoading: boolean
  onMarkRead: (id: string) => void
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function NotificationList({
  notifications,
  userTimezone,
  isLoading,
  onMarkRead,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: NotificationListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore) return
    // P-3: sync check — nếu sentinel đang trong viewport khi effect re-run (hasNextPage flip), trigger ngay
    if (hasNextPage && !isFetchingNextPage) {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight + 200) {
        onLoadMore()
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md p-3">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <BellOff className="h-10 w-10" />
        <p className="text-sm">Chưa có thông báo nào</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          userTimezone={userTimezone}
        />
      ))}
      <div ref={sentinelRef} className="py-2 flex justify-center">
        {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {hasNextPage === false && notifications.length > 0 && (
          <p className="text-xs text-muted-foreground">Đã tải hết thông báo</p>
        )}
      </div>
    </div>
  )
}
