import { toZonedTime, format } from 'date-fns-tz'
import { formatDistanceToNow, isPast } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ScheduleDeadlineBadgeProps {
  deadline: string        // ISO timestamptz từ DB
  userTimezone: string    // IANA timezone của user để display
  className?: string
}

/**
 * ScheduleDeadlineBadge — hiển thị deadline đăng ký lịch với màu sắc theo trạng thái
 *
 * - Đỏ:   đã qua deadline
 * - Vàng: còn < 24 giờ
 * - Xanh: còn nhiều thời gian
 */
export function ScheduleDeadlineBadge({
  deadline,
  userTimezone,
  className,
}: ScheduleDeadlineBadgeProps) {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const isPastDeadline = isPast(deadlineDate)
  const hoursLeft = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isUrgent = !isPastDeadline && hoursLeft < 24

  // Hiển thị deadline theo user timezone
  const deadlineLocal = toZonedTime(deadlineDate, userTimezone)
  const deadlineFormatted = format(deadlineLocal, 'EEE dd/MM HH:mm', {
    timeZone: userTimezone,
    locale: vi,
  })

  if (isPastDeadline) {
    return (
      <Badge
        variant="destructive"
        className={cn('gap-1.5 text-xs font-medium', className)}
      >
        <AlertTriangle className="h-3 w-3" />
        Đã qua deadline — {deadlineFormatted}
      </Badge>
    )
  }

  if (isUrgent) {
    return (
      <Badge
        className={cn(
          'gap-1.5 text-xs font-medium bg-yellow-500 hover:bg-yellow-500 text-white border-yellow-600',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Deadline sắp đến — {deadlineFormatted} (còn{' '}
        {formatDistanceToNow(deadlineDate, { locale: vi })})
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        'gap-1.5 text-xs font-medium bg-green-500 hover:bg-green-500 text-white border-green-600',
        className
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      Deadline: {deadlineFormatted} (còn{' '}
      {formatDistanceToNow(deadlineDate, { locale: vi })})
    </Badge>
  )
}
