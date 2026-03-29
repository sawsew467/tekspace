import { AlertTriangle, CheckCircle, Clock, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ImportReportRow } from '../types/ai-parse.types'

interface ImportPreviewTableProps {
  rows: ImportReportRow[]
  /** Called when user wants to open mapping modal for a specific author */
  onOpenMappingModal: (author: string) => void
  /** Map of external author → TekSpace user full_name */
  authorDisplayNames: Record<string, string>
}

function TaskSummary({ tasks }: { tasks: ImportReportRow['completedTasks'] }) {
  if (tasks.length === 0) return <span className='text-muted-foreground italic'>—</span>
  return (
    <ul className='list-disc list-inside text-xs space-y-0.5'>
      {tasks.map((t, i) => (
        <li key={i}>
          {t.description}
          {t.hours > 0 && (
            <span className='text-muted-foreground ml-1'>· {t.hours}h</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function ReportRow({ row, onOpenMappingModal, authorDisplayNames }: {
  row: ImportReportRow
  onOpenMappingModal: (author: string) => void
  authorDisplayNames: Record<string, string>
}) {
  const mappedUserName = row.userId ? authorDisplayNames[row.author] : null

  return (
    <Collapsible asChild>
      <TableRow className={cn(row.isUnmapped && 'bg-yellow-50 dark:bg-yellow-950/20')}>
        {/* Author */}
        <TableCell>
          <div className='flex items-center gap-2'>
            {row.isUnmapped ? (
              <AlertTriangle className='h-4 w-4 text-yellow-600 shrink-0' />
            ) : (
              <CheckCircle className='h-4 w-4 text-green-600 shrink-0' />
            )}
            <div className='flex flex-col'>
              <span className='text-sm font-medium'>{row.author}</span>
              {row.isUnmapped ? (
                <button
                  type='button'
                  onClick={() => onOpenMappingModal(row.author)}
                  className='text-xs text-left text-yellow-700 dark:text-yellow-400 hover:underline'
                >
                  <Badge variant='outline' className='border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 mt-0.5'>
                    Chưa map
                  </Badge>
                </button>
              ) : (
                <span className='text-xs text-muted-foreground'>
                  → {mappedUserName}
                </span>
              )}
            </div>
          </div>
        </TableCell>

        {/* Date */}
        <TableCell className='text-sm'>
          {new Date(row.date + 'T00:00:00').toLocaleDateString('vi-VN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </TableCell>

        {/* Hours */}
        <TableCell>
          <div className='flex items-center gap-1'>
            <Clock className='h-3.5 w-3.5 text-muted-foreground' />
            <span className='text-sm font-medium'>{row.hoursLogged}h</span>
          </div>
        </TableCell>

        {/* Completed Tasks */}
        <TableCell>
          <TaskSummary tasks={row.completedTasks} />
        </TableCell>

        {/* In Progress Tasks */}
        <TableCell>
          <TaskSummary tasks={row.inProgressTasks} />
        </TableCell>

        {/* Expand / collapse */}
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <ChevronDown className='h-4 w-4' />
            </Button>
          </CollapsibleTrigger>
        </TableCell>
      </TableRow>
    </Collapsible>
  )
}

export function ImportPreviewTable({ rows, onOpenMappingModal, authorDisplayNames }: ImportPreviewTableProps) {
  return (
    <div className='border rounded-lg overflow-hidden'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Người viết</TableHead>
            <TableHead>Ngày</TableHead>
            <TableHead>Giờ</TableHead>
            <TableHead>Đã hoàn thành</TableHead>
            <TableHead>Đang làm</TableHead>
            <TableHead className='w-10'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <ReportRow
              key={row.rowKey}
              row={row}
              onOpenMappingModal={onOpenMappingModal}
              authorDisplayNames={authorDisplayNames}
            />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                Không có report nào để hiển thị
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
