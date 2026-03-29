import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'
import type { ImportMode, ImportResult, ParsedReport } from '../types/ai-parse.types'

export interface ImportReportsPayload {
  /** Reports with author mapped to TekSpace user IDs */
  reports: Array<{
    userId: string
    date: string
    completedTasks: ParsedReport['completed_tasks']
    inProgressTasks: ParsedReport['in_progress_tasks']
    planForTomorrow: string | null
    blockers: string | null
    hoursLogged: number
  }>
  mode: ImportMode
  tenantId: string
  /** If true, skip reports where userId is null */
  importOnlyMapped: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importReports(payload: ImportReportsPayload): Promise<ImportResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Unauthorized')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('import_slack_reports', {
    p_reports: payload.reports.map((r) => ({
      user_id: r.userId,
      report_date: r.date,
      completed_tasks: r.completedTasks,
      in_progress_tasks: r.inProgressTasks,
      plan_for_tomorrow: r.planForTomorrow,
      blockers: r.blockers,
      hours_logged: r.hoursLogged,
    })),
    p_mode: payload.mode,
    p_tenant_id: payload.tenantId,
    p_import_only_mapped: payload.importOnlyMapped,
  })

  if (error) throw error
  return data as unknown as ImportResult
}

export function useImportReports(options?: {
  onSuccess?: (data: ImportResult) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importReports,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

