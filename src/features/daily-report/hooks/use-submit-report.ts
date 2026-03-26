import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import {
  DailyReportService,
  type TaskPayload,
  type DailyReportWithTasks,
} from '@/features/daily-report/services/daily-report.service'

type SubmitReportPayload = {
  tenantId: string
  userId: string
  reportDate: string
  tasks: TaskPayload[]
  hoursLogged: number
  planForTomorrow?: string
  blockers?: string
}

export function useSubmitReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SubmitReportPayload) => DailyReportService.submitReport(payload),
    onSuccess: (data: DailyReportWithTasks, variables: SubmitReportPayload) => {
      // Populate cache ngay lập tức để UI chuyển sang read-only view không cần chờ refetch
      queryClient.setQueryData(
        [QUERY_KEYS.dailyReports, variables.tenantId, { userId: variables.userId, date: variables.reportDate }],
        data,
      )
      // Invalidate để background refetch đảm bảo data fresh
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })
      toast.success('Đã nộp daily report')
    },
    onError: () => {
      toast.error('Không thể nộp báo cáo. Vui lòng thử lại.')
    },
  })
}
