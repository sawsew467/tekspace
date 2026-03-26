import { useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ReportStatusBadge } from '@/features/daily-report/components/ReportStatusBadge'
import { DailyReportView } from '@/features/daily-report/components/DailyReportView'
import type { DailyReportWithTasks } from '@/features/daily-report/services/daily-report.service'

type Props = {
  reports: DailyReportWithTasks[]
  timezone: string
  isLoading?: boolean
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

/**
 * Parse 'yyyy-MM-dd' bằng local Date constructor (tránh UTC offset bug của parseISO).
 * Trả về formatted string; fallback về raw dateStr nếu parse lỗi.
 */
function formatDateLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-').map(Number)
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr
    const [year, month, day] = parts
    return format(new Date(year, month - 1, day), 'EEE, dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export function ReportHistoryList({
  reports,
  timezone,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
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
      <div className='space-y-2'>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-12 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <p className='text-sm text-muted-foreground text-center py-8'>
        Chưa có report nào. Hãy nộp report đầu tiên của bạn!
      </p>
    )
  }

  return (
    <div className='space-y-1'>
      {reports.map((report) => {
        const taskCount = (report.report_tasks ?? []).length
        const status = report.is_late ? 'late' : 'submitted'
        const dateLabel = formatDateLabel(report.report_date)

        return (
          <Collapsible key={report.id}>
            <CollapsibleTrigger asChild>
              <button
                type='button'
                className='w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 rounded-lg group text-left'
              >
                <span className='text-sm font-medium'>{dateLabel}</span>
                <div className='flex items-center gap-2'>
                  <ReportStatusBadge status={status} />
                  <span className='text-sm text-muted-foreground'>{report.hours_logged}h</span>
                  <span className='text-xs text-muted-foreground'>{taskCount} tasks</span>
                  <ChevronDown className='h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180' />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className='px-3 pb-3'>
              <div className='mt-1 border rounded-lg p-3'>
                <DailyReportView report={report} timezone={timezone} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
      <div ref={sentinelRef} className='py-2 flex justify-center'>
        {isFetchingNextPage && <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />}
        {hasNextPage === false && reports.length > 0 && (
          <p className='text-xs text-muted-foreground'>Đã tải hết lịch sử</p>
        )}
      </div>
    </div>
  )
}
