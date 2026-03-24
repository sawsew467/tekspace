import { Badge } from '@/components/ui/badge'

export type ReportStatus = 'submitted' | 'late' | 'missing'

type Props = {
  status: ReportStatus
}

export function ReportStatusBadge({ status }: Props) {
  if (status === 'late') {
    return <Badge variant='destructive'>Nộp muộn</Badge>
  }
  if (status === 'submitted') {
    return <Badge variant='secondary'>Đã nộp</Badge>
  }
  // missing
  return (
    <Badge variant='outline' className='text-muted-foreground'>
      Chưa nộp
    </Badge>
  )
}
