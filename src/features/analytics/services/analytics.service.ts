import { supabase } from '@/lib/supabase-browser'

export type MemberHoursRow = {
  userId: string
  totalHours: number
}

export type WeeklyHoursRow = {
  weekOf: string      // 'yyyy-MM-dd' (Monday ISO week start)
  actualHours: number
}

export type CommittedHoursHistoryRow = {
  effective_from: string
  effective_to: string | null
  committed_hours: number
}

export const AnalyticsService = {
  /**
   * Lấy tổng hours_logged của TỪNG MEMBER trong tenant cho một khoảng ngày.
   * Dùng cho team overview (tuần hiện tại) — manager thấy tất cả qua RLS.
   * Client-side aggregation thay vì RPC để tránh migration mới.
   *
   * RLS: daily_reports_select_policy cho phép manager/owner xem tất cả reports.
   * Explicit fields bắt buộc theo architecture rule khi có JOIN.
   */
  getTeamHoursForPeriod: async (
    tenantId: string,
    periodStart: string, // 'yyyy-MM-dd'
    periodEnd: string,   // 'yyyy-MM-dd'
  ): Promise<MemberHoursRow[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('user_id, hours_logged')
      .eq('tenant_id', tenantId)
      .gte('report_date', periodStart)
      .lte('report_date', periodEnd)
      .limit(10000) // vượt qua Supabase default 1000-row cap

    if (error) throw error

    // Client-side aggregation: group by user_id
    const map = new Map<string, number>()
    for (const row of data ?? []) {
      const h = parseFloat(row.hours_logged)
      if (!isFinite(h)) continue // bỏ qua null / NaN silently
      const prev = map.get(row.user_id) ?? 0
      map.set(row.user_id, prev + h)
    }
    return Array.from(map.entries()).map(([userId, totalHours]) => ({ userId, totalHours }))
  },

  /**
   * Lấy hours_logged của một member theo từng ngày trong khoảng thời gian.
   * Group by ISO week (Monday) thực hiện client-side trong hook.
   * Dùng cho per-member trend chart.
   *
   * RLS: manager/owner thấy tất cả reports trong tenant.
   */
  getMemberReportsForPeriod: async (
    tenantId: string,
    userId: string,
    startDate: string, // 'yyyy-MM-dd'
    endDate: string,   // 'yyyy-MM-dd'
  ): Promise<{ report_date: string; hours_logged: number }[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('report_date, hours_logged')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true })
      .limit(10000) // vượt qua Supabase default 1000-row cap

    if (error) throw error
    return (data ?? []).flatMap(r => {
      const h = parseFloat(r.hours_logged)
      if (!isFinite(h)) return [] // bỏ qua null / NaN
      return [{ report_date: r.report_date, hours_logged: h }]
    })
  },

  /**
   * Lấy lịch sử committed hours của một member cho khoảng thời gian.
   * Trả về tất cả records có hiệu lực trong hoặc chồng lên [startDate, endDate].
   * Dùng để lookup committed hours theo từng tuần trong trend chart.
   *
   * RLS: manager/owner thấy toàn team; member thấy record của chính mình.
   */
  getMemberCommittedHoursHistory: async (
    tenantId: string,
    userId: string,
    startDate: string, // 'yyyy-MM-dd'
    endDate: string,   // 'yyyy-MM-dd'
  ): Promise<CommittedHoursHistoryRow[]> => {
    const { data, error } = await supabase
      .from('committed_hours_history')
      .select('effective_from, effective_to, committed_hours')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .lte('effective_from', endDate)          // record bắt đầu trước hoặc bằng endDate
      .or(`effective_to.is.null,effective_to.gte.${startDate}`)  // record còn hiệu lực sau startDate
      .order('effective_from', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}
