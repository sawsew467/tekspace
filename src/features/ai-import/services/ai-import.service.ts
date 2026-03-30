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

// ── Batch types ───────────────────────────────────────────────────────────────

export interface Batch {
  id: string
  text: string
  dateRange: string
  preview: string
}

// ── Batching helpers ──────────────────────────────────────────────────────────

/**
 * Extract date strings from text for date range display.
 * Matches: D/M/YYYY, D/M/YY, YYYY-MM-DD
 */
function extractDates(text: string): string[] {
  const patterns = [
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    /\d{1,2}\/\d{1,2}\/\d{2}/g,
    /\d{4}-\d{2}-\d{2}/g,
  ]
  const dates: string[] = []
  for (const pat of patterns) {
    let match
    while ((match = pat.exec(text)) !== null) {
      dates.push(match[0])
    }
  }
  return dates
}

/**
 * Split by "Daily report" marker first, then group ~7 reports per batch.
 * This gives meaningful, human-readable batches.
 */
function splitByReportMarker(text: string): string[] {
  // Split on "Daily report" (case-insensitive) boundary
  const parts = text.split(/daily report/i).filter((s) => s.trim().length > 0)
  if (parts.length <= 1) return [text]

  // Re-add "Daily report" prefix to each part
  return parts.map((part) => `Daily report ${part.trim()}`)
}

/**
 * Build batch objects from raw text.
 * Strategy: Each report → ~7 reports per batch for AI context.
 */
export function buildBatches(text: string, reportsPerBatch = 7): Batch[] {
  // Step 1: Split into individual reports
  const reports = splitByReportMarker(text)

  // Step 2: Group reports into batches
  const batches: Batch[] = []
  for (let i = 0; i < reports.length; i += reportsPerBatch) {
    const batchReports = reports.slice(i, i + reportsPerBatch)
    const batchText = batchReports.join('\n\n')
    const dates = extractDates(batchText)
    const uniqueDates = [...new Set(dates)]
    const dateRange = uniqueDates.length > 0
      ? uniqueDates.slice(0, 4).join(', ') + (uniqueDates.length > 4 ? '...' : '')
      : `Báo cáo ${i + 1}–${i + batchReports.length}`
    const preview = batchText.replace(/\s+/g, ' ').trim().slice(0, 80)
    batches.push({
      id: `batch-${i}`,
      text: batchText,
      dateRange,
      preview,
    })
  }

  return batches
}

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
   * Parse a single batch of chat export text via AI.
   * Batching is handled by the UI layer (buildBatches).
   */
  parseReports: async (text: string): Promise<AiParseResponse> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) throw new Error('Unauthorized — no active session')
    return callParseEndpoint(accessToken, text)
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

// ── Internal helper ───────────────────────────────────────────────────────────

async function callParseEndpoint(
  accessToken: string,
  text: string,
  retries = 2,
): Promise<AiParseResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    })

    if (response.ok) {
      return response.json() as Promise<AiParseResponse>
    }

    // 429 = rate limit — retry with longer backoff
    if (response.status === 429 && attempt < retries) {
      const delay = (attempt + 1) * 8000 // 8s, 16s
      await new Promise((resolve) => setTimeout(resolve, delay))
      continue
    }

    // Non-retryable error
    let errorMessage = 'AI parse failed'
    try {
      const errorData = await response.json()
      errorMessage = errorData.error ?? errorMessage
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  // Should not reach here
  throw new Error('AI parse failed after retries')
}

