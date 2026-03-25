import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import {
  DailyReportService,
  type TaskPayload,
} from '@/features/daily-report/services/daily-report.service'

type UpdateReportPayload = {
  reportId: string
  tasks: TaskPayload[]
  hoursLogged: number
}

export function useUpdateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateReportPayload) =>
      DailyReportService.updateReport(payload.reportId, payload.tasks, payload.hoursLogged),
    onSuccess: () => {
      // Invalidate để refetch report với updated_at mới
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })
      toast.success('Đã cập nhật report')
    },
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error('[useUpdateReport] failed:', error)
      toast.error('Cập nhật thất bại. Vui lòng thử lại.')
    },
  })
}
