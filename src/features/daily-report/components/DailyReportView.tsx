import { toZonedTime, format } from 'date-fns-tz'
import { ExternalLink, Clock, CheckCircle2, Pencil, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { OUTPUT_TYPE_LABELS, type OutputType } from '@/features/daily-report/schemas/daily-report.schema'
import type { DailyReportWithTasks, ReportTask } from '@/features/daily-report/services/daily-report.service'

type Props = {
  report: DailyReportWithTasks
  timezone: string
  showEditButton?: boolean  // Story 4.6: hiện nút "Chỉnh sửa" khi còn trong deadline window
  onEdit?: () => void       // Story 4.6: callback khi click "Chỉnh sửa"
}

// ── Task Card Component ──────────────────────────────────────────────────────

function CompletedTaskCard({ task }: { task: ReportTask }) {
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
    <div className='rounded-lg border p-3 space-y-1.5'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0 flex-wrap'>
          {/* Project tag badge — optional */}
          {task.project_tag && (
            <Badge variant='outline' className='text-xs font-mono shrink-0'>
              {task.project_tag}
            </Badge>
          )}
          <p className='text-sm font-medium leading-snug'>{task.description}</p>
          {/* Per-task hours badge */}
          {task.hours !== undefined && task.hours !== null && task.hours > 0 && (
            <span className='text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded'>
              {task.hours}h
            </span>
          )}
        </div>
        {task.output_type && (
          <Badge variant='secondary' className='text-xs shrink-0'>
            {OUTPUT_TYPE_LABELS[task.output_type as OutputType] ?? task.output_type}
          </Badge>
        )}
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
}

function InProgressTaskCard({ task }: { task: ReportTask }) {
  return (
    <div className='rounded-lg border border-dashed p-3'>
      <div className='flex items-center gap-2 flex-wrap'>
        {task.project_tag && (
          <Badge variant='outline' className='text-xs font-mono shrink-0'>
            {task.project_tag}
          </Badge>
        )}
        <p className='text-sm text-muted-foreground leading-snug flex-1'>{task.description}</p>
        {task.hours !== undefined && task.hours !== null && task.hours > 0 && (
          <span className='text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded'>
            {task.hours}h
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DailyReportView({ report, timezone, showEditButton, onEdit }: Props) {
  const tasks = report.report_tasks ?? []

  // Section 1: task_type = 'completed' hoặc undefined (backward compat với migrated data)
  const completedTasks = tasks.filter(t => t.task_type !== 'in_progress')
  // Section 2: task_type = 'in_progress'
  const inProgressTasks = tasks.filter(t => t.task_type === 'in_progress')

  const submittedAtLocal = report.submitted_at
    ? format(toZonedTime(new Date(report.submitted_at), timezone), 'dd/MM/yyyy HH:mm', { timeZone: timezone })
    : '—'

  const wasEdited = report.updated_at != null
  const updatedAtLocal = wasEdited && report.updated_at
    ? format(toZonedTime(new Date(report.updated_at), timezone), 'dd/MM/yyyy HH:mm', { timeZone: timezone })
    : null

  return (
    <div className='space-y-5'>
      {/* Header — status + hours + submitted_at */}
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
            <Badge variant='destructive'>Nộp muộn</Badge>
          )}
          {showEditButton && onEdit && (
            <Button variant='outline' size='sm' onClick={onEdit}>
              <Pencil className='h-3.5 w-3.5 mr-1' />
              Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Section 1: Tasks Completed Today */}
      <div className='space-y-3'>
        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5'>
          <CheckCircle2 className='h-3.5 w-3.5 text-green-500' />
          Tasks Completed ({completedTasks.length})
        </p>
        {completedTasks.length === 0 ? (
          <p className='text-sm text-muted-foreground italic'>Không có task nào được ghi nhận.</p>
        ) : (
          completedTasks.map(task => (
            <CompletedTaskCard key={task.id} task={task} />
          ))
        )}
      </div>

      {/* Section 2: In Progress / Ongoing — ẩn nếu không có items */}
      {inProgressTasks.length > 0 && (
        <>
          <Separator />
          <div className='space-y-3'>
            <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5'>
              <Timer className='h-3.5 w-3.5 text-orange-500' />
              In Progress / Ongoing ({inProgressTasks.length})
            </p>
            {inProgressTasks.map(task => (
              <InProgressTaskCard key={task.id} task={task} />
            ))}
          </div>
        </>
      )}

      {/* Section 3: Plan for Tomorrow — ẩn nếu null/empty */}
      {report.plan_for_tomorrow && report.plan_for_tomorrow.trim() !== '' && (
        <>
          <Separator />
          <div className='space-y-2'>
            <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              📋 Plan for Tomorrow
            </p>
            <p className='text-sm whitespace-pre-wrap leading-relaxed'>{report.plan_for_tomorrow}</p>
          </div>
        </>
      )}

      {/* Section 4: Blockers / Issues — ẩn nếu null/empty */}
      {report.blockers && report.blockers.trim() !== '' && (
        <>
          <Separator />
          <div className='space-y-2'>
            <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              🚧 Blockers / Issues
            </p>
            <p className='text-sm whitespace-pre-wrap leading-relaxed text-destructive/80'>{report.blockers}</p>
          </div>
        </>
      )}
    </div>
  )
}
