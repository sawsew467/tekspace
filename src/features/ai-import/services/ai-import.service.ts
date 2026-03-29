import { supabase } from '@/lib/supabase-browser'
import type {
  AiParseResponse,
  ImportResult,
  ImportMode,
  ImportReportRow,
  AuthorMapping,
  TekSpaceUser,
} from '../types/ai-parse.types'

// ── Edge Function URL ─────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-parse`

// ── Internal types ────────────────────────────────────────────────────────────

interface TenantMember {
  user_id: string
  users: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

// ── Service ───────────────────────────────────────────────────────────────────

export const AiImportService = {
  /**
   * Parse raw chat export text using AI (Supabase Edge Function).
   */
  parseReports: async (text: string): Promise<AiParseResponse> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) throw new Error('Unauthorized — no active session')

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      let errorMessage = 'AI parse failed'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error ?? errorMessage
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(errorMessage)
    }

    const data = await response.json() as AiParseResponse
    return data
  },

  /**
   * Import parsed reports via RPC.
   */
  importReports: async (
    reports: ImportReportRow[],
    mode: ImportMode,
    tenantId: string,
    importOnlyMapped: boolean,
  ): Promise<ImportResult> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) throw new Error('Unauthorized')

    const mappedReports = reports
      .filter((r) => !importOnlyMapped || r.userId !== null)
      .map((r) => ({
        user_id: r.userId!,
        report_date: r.date,
        completed_tasks: r.completedTasks,
        in_progress_tasks: r.inProgressTasks,
        plan_for_tomorrow: r.planForTomorrow,
        blockers: r.blockers,
        hours_logged: r.hoursLogged,
      }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('import_slack_reports', {
      p_reports: mappedReports,
      p_mode: mode,
      p_tenant_id: tenantId,
      p_import_only_mapped: importOnlyMapped,
    })

    if (error) throw error
    return data as unknown as ImportResult
  },

  /**
   * Get all active TekSpace users for a tenant (for author mapping).
   * Returns users with id + full_name for matching.
   */
  getTenantUsers: async (tenantId: string): Promise<TekSpaceUser[]> => {
    const { data, error } = await supabase
      .from('tenant_members')
      .select(`
        user_id,
        users:users(id, full_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (error) throw error

    return ((data as unknown as TenantMember[]) ?? [])
      .filter((m) => m.users !== null)
      .map((m) => ({
        id: m.users!.id,
        full_name: m.users!.full_name,
      }))
  },

  /**
   * Convert LLM-parsed reports to ImportReportRow, auto-mapping authors.
   */
  buildImportRows: (
    parsedReports: AiParseResponse['reports'],
    autoMappings: Record<string, AuthorMapping>,
  ): ImportReportRow[] => {
    return parsedReports.map((report) => {
      const mapping = autoMappings[report.author]
      const userId = mapping?.userId ?? null

      // hours_logged = sum of all task hours (completed + in_progress)
      const completedHours = report.completed_tasks.reduce((sum, t) => sum + t.hours, 0)
      const inProgressHours = report.in_progress_tasks.reduce((sum, t) => sum + t.hours, 0)
      const hoursLogged = completedHours + inProgressHours

      const rowKey = `${report.author}__${report.date}`

      return {
        rowKey,
        author: report.author,
        date: report.date,
        completedTasks: report.completed_tasks,
        inProgressTasks: report.in_progress_tasks,
        planForTomorrow: report.plan_for_tomorrow,
        blockers: report.blockers,
        hoursLogged,
        userId,
        isUnmapped: userId === null,
      }
    })
  },

  /**
   * Update import rows after user changes a mapping.
   */
  updateRowMapping: (
    rows: ImportReportRow[],
    externalAuthor: string,
    newUserId: string,
  ): ImportReportRow[] => {
    return rows.map((row) =>
      row.author === externalAuthor ? { ...row, userId: newUserId, isUnmapped: false } : row
    )
  },
}
