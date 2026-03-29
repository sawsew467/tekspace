import { z } from 'zod'

// ── Raw parsed report from LLM ───────────────────────────────────────────────

export const TaskItemSchema = z.object({
  description: z.string().min(1),
  hours: z.number().int().min(0).default(0),
})

export const ParsedReportSchema = z.object({
  author: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format YYYY-MM-DD'),
  completed_tasks: z.array(TaskItemSchema).default([]),
  in_progress_tasks: z.array(TaskItemSchema).default([]),
  plan_for_tomorrow: z.string().nullable().catch(null),
  blockers: z.string().nullable().catch(null),
})

export const AiParseResponseSchema = z.object({
  reports: z.array(ParsedReportSchema),
})

export type TaskItem = z.infer<typeof TaskItemSchema>
export type ParsedReport = z.infer<typeof ParsedReportSchema>
export type AiParseResponse = z.infer<typeof AiParseResponseSchema>

// ── Author mapping ───────────────────────────────────────────────────────────

export interface AuthorMapping {
  /** Author name as returned by LLM (may contain diacritics) */
  externalAuthor: string
  /** TekSpace user ID to map to */
  userId: string
  /** Match confidence score 0–1 */
  confidence: number
}

export interface UserMappingState {
  mappings: Record<string, AuthorMapping>
  /** LRU cache of external authors keyed by tenant */
  cacheKey: string
}

export interface TekSpaceUser {
  id: string
  full_name: string
}

// ── Import mode ─────────────────────────────────────────────────────────────

export const ImportModeSchema = z.enum(['skip', 'overwrite'])
export type ImportMode = z.infer<typeof ImportModeSchema>

// ── Import report row (before user mapping) ─────────────────────────────────

export interface ImportReportRow {
  /** Stable key for this row (author + date) */
  rowKey: string
  author: string
  date: string
  completedTasks: TaskItem[]
  inProgressTasks: TaskItem[]
  planForTomorrow: string | null
  blockers: string | null
  /** Computed total hours = sum of all task hours */
  hoursLogged: number
  /** Mapped userId — null means unmapped */
  userId: string | null
  /** True if this author could not be auto-mapped */
  isUnmapped: boolean
}

// ── Import result from RPC ──────────────────────────────────────────────────

export const ImportResultSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  overwritten: z.number().int().min(0),
  errors: z.array(z.object({
    rowKey: z.string(),
    message: z.string(),
  })).default([]),
})

export type ImportResult = z.infer<typeof ImportResultSchema>
