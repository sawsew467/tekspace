import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type DailyReport = Tables<'daily_reports'>

export type TeamReportRow = {
  id: string
  tenant_id: string
  user_id: string
  report_date: string
  tasks: DailyReport['tasks']  // jsonb — same type as DailyReport.tasks, DailyReportView guards with Array.isArray
  hours_logged: number
  is_late: boolean
  submitted_at: string
  created_at: string
  // users có thể null nếu user bị xóa sau khi submit (FK orphan từ PostgREST JOIN)
  users: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

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

  /**
   * Lấy toàn bộ history reports của một user (không giới hạn date range).
   * RLS: member chỉ thấy user_id = auth.uid() → tự nhiên chỉ thấy report của mình.
   * Giới hạn 365 rows — đủ cho 1 năm lịch sử.
   */
  getAllReports: async (
    tenantId: string,
    userId: string,
  ): Promise<DailyReport[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .limit(365)
    if (error) throw error
    return (data ?? []) as DailyReport[]
  },

  /**
   * Lấy danh sách report_date của user — lightweight query chỉ lấy dates,
   * dùng để tính streak mà không cần fetch full report data.
   * Eager-fetched ngay khi load trang.
   */
  getReportDates: async (
    tenantId: string,
    userId: string,
  ): Promise<string[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('report_date')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map(r => r.report_date)
  },

  /**
   * Lấy tất cả reports của team cho một ngày cụ thể.
   * RLS policy cho phép manager/owner xem tất cả reports trong tenant.
   * Explicit fields bắt buộc khi có JOIN (architecture rule).
   */
  getTeamReportsForDate: async (
    tenantId: string,
    reportDate: string,
  ): Promise<TeamReportRow[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, created_at, users(id, full_name, avatar_url)')
      .eq('tenant_id', tenantId)
      .eq('report_date', reportDate)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    // F8: filter out orphaned rows where JOIN returned users=null (user deleted after submit)
    return ((data ?? []) as TeamReportRow[]).filter(r => r.users != null)
  },
}
