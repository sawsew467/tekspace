import { toZonedTime, format } from 'date-fns-tz'
import { ExternalLink, Clock, CheckCircle2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { OUTPUT_TYPE_LABELS, type OutputType } from '@/features/daily-report/schemas/daily-report.schema'
import type { DailyReport } from '@/features/daily-report/services/daily-report.service'

type TaskData = {
  description: string
  output_type: string
  output_link?: string
  hours?: number  // Per-task hours (Story 4.5) — optional, backward compat với old reports
}

type Props = {
  report: DailyReport
  timezone: string
  showEditButton?: boolean  // Story 4.6: hiện nút "Chỉnh sửa" khi còn trong deadline window
  onEdit?: () => void       // Story 4.6: callback khi click "Chỉnh sửa"
}

export function DailyReportView({ report, timezone, showEditButton, onEdit }: Props) {
  // Array.isArray guard: phòng trường hợp tasks là null/non-array từ DB
  const tasks = Array.isArray(report.tasks) ? (report.tasks as TaskData[]) : []

  // Null guard cho submitted_at: phòng crash nếu column null
  const submittedAtLocal = report.submitted_at
    ? format(toZonedTime(new Date(report.submitted_at), timezone), 'dd/MM/yyyy HH:mm', { timeZone: timezone })
    : '—'

  // Story 4.6: updated_at != null → đã được chỉnh sửa (trigger chỉ set khi UPDATE)
  const wasEdited = report.updated_at != null
  const updatedAtLocal = wasEdited && report.updated_at
    ? format(toZonedTime(new Date(report.updated_at), timezone), 'dd/MM/yyyy HH:mm', { timeZone: timezone })
    : null

  return (
    <div className='space-y-5'>
      {/* Header — compact: status + hours + submitted_at */}
      <div className='flex items-center gap-3'>
        <CheckCircle2 className='h-5 w-5 text-green-500 shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-medium'>
            Đã nộp · <span className='font-semibold'>{report.hours_logged}h</span>
          </p>
          <div className='text-xs text-muted-foreground flex items-center gap-1 mt-0.5'>
            <Clock className='h-3 w-3' />
            {submittedAtLocal}
            {wasEdited && (
              <>
                <span className='mx-1'>·</span>
                <Badge variant='outline' className='text-xs py-0 px-1.5 h-4'>
                  Đã chỉnh sửa {updatedAtLocal}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {report.is_late && (
            <Badge variant='destructive'>
              Nộp muộn
            </Badge>
          )}
          {/* Story 4.6: nút Chỉnh sửa — chỉ hiện khi còn trong deadline window */}
          {showEditButton && onEdit && (
            <Button variant='outline' size='sm' onClick={onEdit}>
              <Pencil className='h-3.5 w-3.5 mr-1' />
              Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Tasks */}
      <div className='space-y-3'>
        <p className='text-xs text-muted-foreground uppercase tracking-wider'>
          Tasks ({tasks.length})
        </p>
        {tasks.length === 0 ? (
          <p className='text-sm text-muted-foreground italic'>Không có task nào được ghi nhận.</p>
        ) : (
          tasks.map((task, idx) => {
            // Sanitize output_link: chỉ cho phép http/https để chặn XSS qua javascript: scheme
            let safeHref: string | null = null
            if (task.output_link) {
              try {
                const parsed = new URL(task.output_link)
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                  safeHref = task.output_link
                }
              } catch { /* invalid URL — render as plain text */ }
            }

            return (
              <div key={idx} className='rounded-lg border p-3 space-y-1.5'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <p className='text-sm font-medium leading-snug'>{task.description}</p>
                    {/* Per-task hours badge — chỉ hiện nếu > 0, backward compat với old reports */}
                    {task.hours !== undefined && task.hours > 0 && (
                      <span className='text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded'>
                        {task.hours}h
                      </span>
                    )}
                  </div>
                  <Badge variant='secondary' className='text-xs shrink-0'>
                    {OUTPUT_TYPE_LABELS[task.output_type as OutputType] ?? task.output_type}
                  </Badge>
                </div>
                {task.output_link && (
                  safeHref ? (
                    <a
                      href={safeHref}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all'
                    >
                      <ExternalLink className='h-3 w-3 shrink-0' />
                      {task.output_link}
                    </a>
                  ) : (
                    <span className='inline-flex items-center gap-1 text-xs text-muted-foreground break-all'>
                      <ExternalLink className='h-3 w-3 shrink-0' />
                      {task.output_link}
                    </span>
                  )
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
