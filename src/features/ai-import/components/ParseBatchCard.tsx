import { CheckCircle, XCircle, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BatchStatus = 'pending' | 'loading' | 'success' | 'error'

interface Batch {
  id: string
  text: string
  dateRange: string
  /** First 80 chars of text as preview */
  preview: string
}

interface BatchCardProps {
  batch: Batch
  status: BatchStatus
  error?: string
  reportCount?: number
  selected: boolean
  onToggle: () => void
  onRetry: () => void
  disabled?: boolean
}

export function BatchCard({
  batch,
  status,
  error,
  reportCount,
  selected,
  onToggle,
  onRetry,
  disabled,
}: BatchCardProps) {
  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        selected && status === 'pending' && 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
        status === 'success' && 'border-green-400 bg-green-50 dark:bg-green-950/20',
        status === 'error' && 'border-red-400 bg-red-50 dark:bg-red-950/20',
        !selected && status === 'pending' && 'opacity-60',
      )}
    >
      <div className='flex items-start gap-3'>
        {/* Checkbox */}
        <input
          type='checkbox'
          checked={selected}
          onChange={onToggle}
          disabled={disabled || status === 'loading'}
          className='mt-1 h-4 w-4 rounded border-gray-400 cursor-pointer'
        />

        <div className='flex-1 min-w-0'>
          {/* Header: date range + status badge */}
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium'>{batch.dateRange}</span>
            {status === 'pending' && (
              <span className='text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
                Chờ
              </span>
            )}
            {status === 'loading' && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'>
                <Loader2 className='h-3 w-3 animate-spin' />
                Đang parse...
              </span>
            )}
            {status === 'success' && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200'>
                <CheckCircle className='h-3 w-3' />
                {reportCount ?? '?'} reports
              </span>
            )}
            {status === 'error' && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200'>
                <XCircle className='h-3 w-3' />
                Lỗi
              </span>
            )}
          </div>

          {/* Preview text */}
          <p className='text-xs text-muted-foreground truncate font-mono'>
            {batch.preview}
          </p>

          {/* Error message */}
          {status === 'error' && error && (
            <p className='text-xs text-red-600 dark:text-red-400 mt-1'>{error}</p>
          )}
        </div>

        {/* Retry button */}
        {status === 'error' && (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400'
            onClick={onRetry}
          >
            <RotateCcw className='h-3 w-3' />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
