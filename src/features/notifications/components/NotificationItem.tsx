import { formatDistanceToNow, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import { useRouter } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { Notification } from '@/features/notifications/services/notifications.service'

type NotificationItemProps = {
  notification: Notification
  onMarkRead: (id: string) => void
  // null khi timezone chưa load — tooltip sẽ ẩn để tránh giá trị UTC nhảy sang local (P11)
  userTimezone: string | null
}

export function NotificationItem({
  notification,
  onMarkRead,
  userTimezone,
}: NotificationItemProps) {
  const router = useRouter()

  const handleClick = () => {
    // P6: chỉ gọi onMarkRead khi notification chưa read — tránh DB write thừa
    if (!notification.is_read) {
      onMarkRead(notification.id)
    }

    // P3: chỉ navigate với internal path — reject protocol-relative (//) và external URL
    const linkTo = notification.link_to
    if (linkTo && linkTo.startsWith('/') && !linkTo.startsWith('//')) {
      router.navigate({ to: linkTo })
    }
  }

  // P9: guard against invalid/null created_at để tránh RangeError
  const utcDate = notification.created_at
    ? new Date(notification.created_at)
    : new Date()

  // P12: dùng chung utcDate — không tạo new Date() hai lần
  const tz = userTimezone ?? 'UTC'
  const zonedDate = toZonedTime(utcDate, tz)

  // Relative time: dùng UTC date gốc — KHÔNG dùng zonedDate (sẽ lệch ±timezone offset)
  const relativeTime = formatDistanceToNow(utcDate, {
    addSuffix: true,
    locale: vi,
  })

  // Absolute time (tooltip): dùng zonedDate để hiển thị đúng timezone user
  // P11: chỉ hiển thị khi timezone đã xác nhận (userTimezone !== null)
  const absoluteTime =
    userTimezone !== null
      ? format(zonedDate, 'dd/MM/yyyy HH:mm', { locale: vi })
      : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        // P8: WCAG 2.1 — role="button" phải respond cả Enter lẫn Space
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={cn(
        'cursor-pointer rounded-md p-3 transition-colors hover:bg-accent',
        !notification.is_read && 'bg-muted/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {!notification.is_read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          )}
          <p className={cn('text-sm', !notification.is_read ? 'font-medium' : 'text-muted-foreground')}>
            {notification.message}
          </p>
        </div>
        <time
          dateTime={notification.created_at}
          title={absoluteTime}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {relativeTime}
        </time>
      </div>
    </div>
  )
}
