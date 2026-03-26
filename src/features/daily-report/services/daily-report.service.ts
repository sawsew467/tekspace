import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DailyReport = Tables<'daily_reports'>
export type ReportTask = Tables<'report_tasks'>

/**
 * DailyReport với embedded report_tasks (dùng cho view, cache, history).
 * Thay thế pattern cũ (JSONB tasks) — Story 9.2.
 */
export type DailyReportWithTasks = DailyReport & {
  report_tasks: ReportTask[]
}

export type TeamReportRow = DailyReportWithTasks & {
  // users có thể null nếu user bị xóa sau khi submit (FK orphan từ PostgREST JOIN)
  users: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

/**
 * Payload cho một task khi submit/update report.
 * task_type phân biệt Section 1 (completed) và Section 2 (in_progress).
 */
export type TaskPayload = {
  task_type?: 'completed' | 'in_progress'  // default: 'completed'
  project_tag?: string
  description: string
  output_type?: string   // chỉ cần cho completed tasks
  output_link?: string
  hours?: number         // chỉ cần cho completed tasks
}

// ── Select Strings ────────────────────────────────────────────────────────────

const DAILY_REPORT_SELECT = `
  id, tenant_id, user_id, report_date,
  hours_logged, is_late, submitted_at, updated_at, created_at,
  plan_for_tomorrow, blockers,
  report_tasks(id, task_type, project_tag, description, output_type, output_link, hours, sort_order)
`.trim()

const TEAM_REPORT_SELECT = `
  id, tenant_id, user_id, report_date,
  hours_logged, is_late, submitted_at, updated_at, created_at,
  plan_for_tomorrow, blockers,
  report_tasks(id, task_type, project_tag, description, output_type, output_link, hours, sort_order),
  users(id, full_name, avatar_url)
`.trim()

/**
 * Sort tasks theo sort_order ascending sau khi fetch về.
 * PostgREST không đảm bảo thứ tự embedded rows.
 * Null-guard: PostgREST có thể trả null (không phải []) cho embedded relation rỗng.
 */
function sortTasks(report: DailyReportWithTasks): DailyReportWithTasks {
  return {
    ...report,
    report_tasks: [...(report.report_tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const DailyReportService = {
  /**
   * Lấy report của ngày hôm nay, kèm embedded report_tasks.
   * Dùng maybeSingle() — trả null nếu chưa submit, không throw.
   */
  getTodayReport: async (
    tenantId: string,
    userId: string,
    reportDate: string, // 'yyyy-MM-dd'
  ): Promise<DailyReportWithTasks | null> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('report_date', reportDate)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return sortTasks(data as DailyReportWithTasks)
  },

  /**
   * Submit daily report:
   * 1. INSERT daily_report row
   * 2. INSERT report_tasks rows (batch)
   * 3. Trả về report kèm tasks (đã insert)
   *
   * is_late được tính tự động bởi DB trigger.
   */
  submitReport: async (payload: {
    tenantId: string
    userId: string
    reportDate: string
    tasks: TaskPayload[]
    hoursLogged: number
    planForTomorrow?: string
    blockers?: string
  }): Promise<DailyReportWithTasks> => {
    // Step 1: Insert daily_report
    const { data: report, error: reportError } = await supabase
      .from('daily_reports')
      .insert({
        tenant_id: payload.tenantId,
        user_id: payload.userId,
        report_date: payload.reportDate,
        hours_logged: payload.hoursLogged,
        plan_for_tomorrow: payload.planForTomorrow ?? null,
        blockers: payload.blockers ?? null,
        // Không set: is_late (trigger), submitted_at (DEFAULT), created_at (DEFAULT)
      })
      .select('id')
      .single()
    if (reportError) throw reportError

    // Step 2: Insert report_tasks rows (batch nếu có tasks)
    // Nếu insert fails → compensating cleanup: delete orphaned daily_report row
    if (payload.tasks.length > 0) {
      const taskRows = payload.tasks.map((t, i) => ({
        tenant_id: payload.tenantId,
        report_id: report.id,
        user_id: payload.userId,
        task_type: t.task_type ?? 'completed',
        project_tag: t.project_tag ?? null,
        description: t.description,
        output_type: t.output_type ?? null,
        output_link: t.output_link ?? null,
        hours: t.hours ?? null,
        sort_order: i,
      }))
      const { error: tasksError } = await supabase
        .from('report_tasks')
        .insert(taskRows)
      if (tasksError) {
        // Compensating action: xóa orphaned report row để tránh poison ngày hôm nay
        await supabase.from('daily_reports').delete().eq('id', report.id)
        throw tasksError
      }
    }

    // Step 3: Fetch full report với tasks
    const { data: fullReport, error: fetchError } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('id', report.id)
      .single()
    if (fetchError) throw fetchError
    return sortTasks(fullReport as DailyReportWithTasks)
  },

  /**
   * Lấy toàn bộ history reports của một user kèm tasks.
   * Giới hạn 365 rows — đủ cho 1 năm lịch sử.
   */
  getAllReports: async (
    tenantId: string,
    userId: string,
  ): Promise<DailyReportWithTasks[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .limit(365)
    if (error) throw error
    return ((data ?? []) as DailyReportWithTasks[]).map(sortTasks)
  },

  /**
   * Cập nhật report đã submit (trong deadline window).
   * Flow: UPDATE daily_reports → fetch old task IDs → INSERT new tasks → DELETE old by IDs.
   * INSERT-before-DELETE đảm bảo không có window zero tasks nếu INSERT fail.
   * RLS UPDATE policy đảm bảo chỉ owner trong cùng tenant mới được update.
   */
  updateReport: async (
    reportId: string,
    tasks: TaskPayload[],
    hoursLogged: number,
    options?: { planForTomorrow?: string; blockers?: string },
  ): Promise<DailyReportWithTasks> => {
    // Step 1: Update daily_reports
    const { data: updatedReport, error: updateError } = await supabase
      .from('daily_reports')
      .update({
        hours_logged: hoursLogged,
        plan_for_tomorrow: options?.planForTomorrow ?? null,
        blockers: options?.blockers ?? null,
        // updated_at set tự động bởi DB trigger
      })
      .eq('id', reportId)
      .select('id, tenant_id, user_id')
      .single()
    if (updateError) throw updateError

    // Step 2: Fetch old task IDs — để xóa đúng sau khi insert new tasks
    // (tránh window zero tasks: insert trước, delete sau; xóa bằng ID cụ thể, không bằng report_id)
    const { data: oldTaskRows, error: fetchOldError } = await supabase
      .from('report_tasks')
      .select('id')
      .eq('report_id', reportId)
    if (fetchOldError) throw fetchOldError
    const oldTaskIds = (oldTaskRows ?? []).map(t => t.id)

    // Step 3: Insert new tasks TRƯỚC khi delete old — nếu insert fail, old tasks còn nguyên
    if (tasks.length > 0) {
      const taskRows = tasks.map((t, i) => ({
        tenant_id: updatedReport.tenant_id,
        report_id: reportId,
        user_id: updatedReport.user_id,
        task_type: t.task_type ?? 'completed',
        project_tag: t.project_tag ?? null,
        description: t.description,
        output_type: t.output_type ?? null,
        output_link: t.output_link ?? null,
        hours: t.hours ?? null,
        sort_order: i,
      }))
      const { error: insertError } = await supabase
        .from('report_tasks')
        .insert(taskRows)
      if (insertError) throw insertError
    }

    // Step 4: Delete old tasks bằng ID cụ thể (không dùng eq(report_id) để tránh xóa tasks vừa insert)
    if (oldTaskIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('report_tasks')
        .delete()
        .in('id', oldTaskIds)
      if (deleteError) throw deleteError
    }

    // Step 5: Fetch updated report với tasks
    const { data: fullReport, error: fetchError } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('id', reportId)
      .single()
    if (fetchError) throw fetchError
    return sortTasks(fullReport as DailyReportWithTasks)
  },

  /**
   * Lấy danh sách report_date của user — lightweight query chỉ lấy dates,
   * dùng để tính streak mà không cần fetch full report data.
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
   * Tính tổng hours_logged của một user trong một tuần.
   * Lightweight — chỉ lấy hours_logged, không join tasks.
   */
  getSelfWeekHours: async (
    tenantId: string,
    userId: string,
    weekStart: string,
    weekEnd: string,
  ): Promise<number> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('hours_logged')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('report_date', weekStart)
      .lte('report_date', weekEnd)
    if (error) throw error
    return (data ?? []).reduce((sum, r) => sum + (Number(r.hours_logged) || 0), 0)
  },

  /**
   * Lấy tất cả reports của team cho một ngày, kèm tasks và user info.
   * Chỉ manager/owner mới được gọi (RLS).
   */
  getTeamReportsForDate: async (
    tenantId: string,
    reportDate: string,
  ): Promise<TeamReportRow[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(TEAM_REPORT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('report_date', reportDate)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as TeamReportRow[])
      .filter(r => r.users != null)
      .map(r => ({ ...sortTasks(r as DailyReportWithTasks), users: r.users }) as TeamReportRow)
  },

  /**
   * Lấy history reports phân trang (dùng cho infinite scroll).
   */
  getAllReportsPaged: async (
    tenantId: string,
    userId: string,
    from: number,
    to: number,
  ): Promise<DailyReportWithTasks[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select(DAILY_REPORT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .range(from, to)
    if (error) throw error
    return ((data ?? []) as DailyReportWithTasks[]).map(sortTasks)
  },
}
