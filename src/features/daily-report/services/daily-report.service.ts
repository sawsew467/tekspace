import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type DailyReport = Tables<'daily_reports'>

export type TaskPayload = {
  description: string
  output_type: string
  output_link?: string
}

export const DailyReportService = {
  /**
   * Lấy report của ngày hôm nay.
   * Dùng maybeSingle() — trả null nếu chưa submit, không throw.
   */
  getTodayReport: async (
    tenantId: string,
    userId: string,
    reportDate: string, // 'yyyy-MM-dd'
  ): Promise<DailyReport | null> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('report_date', reportDate)
      .maybeSingle()
    if (error) throw error
    return data
  },

  /**
   * Submit daily report.
   * is_late được tính tự động bởi DB trigger — KHÔNG truyền từ client.
   * submitted_at và created_at dùng DEFAULT now().
   */
  submitReport: async (payload: {
    tenantId: string
    userId: string
    reportDate: string
    tasks: TaskPayload[]
    hoursLogged: number
  }): Promise<DailyReport> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        tenant_id: payload.tenantId,
        user_id: payload.userId,
        report_date: payload.reportDate,
        tasks: payload.tasks,
        hours_logged: payload.hoursLogged,
        // Không set: is_late (trigger), submitted_at (DEFAULT), created_at (DEFAULT)
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  },
}
