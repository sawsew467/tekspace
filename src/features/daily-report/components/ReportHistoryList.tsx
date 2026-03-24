import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ReportStatusBadge } from '@/features/daily-report/components/ReportStatusBadge'
import { DailyReportView } from '@/features/daily-report/components/DailyReportView'
import type { DailyReport } from '@/features/daily-report/services/daily-report.service'

type Props = {
  reports: DailyReport[]
  timezone: string
  isLoading?: boolean
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

export function ReportHistoryList({ reports, timezone, isLoading }: Props) {
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
        const taskCount = Array.isArray(report.tasks) ? report.tasks.length : 0
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
    </div>
  )
}

