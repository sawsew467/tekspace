import { corsHeaders } from '../_shared/cors.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

// Kong gateway đã verify JWT signature rồi (với --no-verify-jwt flag thì bypass,
// nhưng token vẫn phải đúng format JWT).
// Chỉ cần decode payload để verify token có đúng format + có sub claim.
// Không throw Response vì Deno không xử lý tốt.
function validateAuth(req: Request): { id: string; email: string } | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.slice(7)
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(payloadB64))

    // Cần có sub (user ID) — email có thể không có trong một số JWT
    if (!payload.sub) return null
    return {
      id: payload.sub,
      email: payload.email ?? '',
    }
  } catch {
    return null
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Parse daily standup reports từ chat export (Slack, Discord, MS Teams...) thành JSON array.

Rules:
- Trích xuất TẤT CẢ reports trong input (không giới hạn số lượng)
- author: tên hiển thị trong message header

**DATE PARSING (quan trọng):**
- Luôn parse date format "D/M" hoặc "DD/MM" là DAY/MONTH, KHÔNG PHẢI month/day
  - Ví dụ: "5/2" = ngày 5 tháng 2 (2025-02-05), KHÔNG phải ngày 2 tháng 5
  - Ví dụ: "29/12" = ngày 29 tháng 12 (2025-12-29), KHÔNG phải ngày 12 tháng 29
  - Ví dụ: "30/12" = ngày 30 tháng 12 (2025-12-30), KHÔNG phải ngày 12 tháng 30
- Nếu report không ghi năm, SUY RA từ context:
  - Xem các report khác có cùng ngày/tháng để lấy năm
  - Hoặc xem thứ tự messages để suy ra năm gần nhất
  - Mặc định: năm của report gần nhất với thời điểm hiện tại
- Format output: YYYY-MM-DD

- completed_tasks / in_progress_tasks: mỗi task gồm {description, hours}. Nếu hours không đề cập, ước lượng 1-4h
- Bỏ qua section trống hoặc "N/A"
- plan_for_tomorrow / blockers: string hoặc null
- hours: dùng giá trị số (3h → 3, 1h30 → 1.5)

Output: JSON array không markdown wrapper.
[{"author":"Tên","date":"YYYY-MM-DD","completed_tasks":[{"description":"...","hours":2}],"in_progress_tasks":[],"plan_for_tomorrow":null,"blockers":null}]`

// ── Response Schema (Zod-like validation) ────────────────────────────────────

interface TaskItem {
  description: string
  hours: number
}

/**
 * Normalize date string — handle AI misparsing like "2025-02-05" from "5/2".
 * If date parts look swapped (month > 12), swap them back.
 */
function normalizeDate(dateStr: string, fallbackYear = 2025): string {
  // Already valid YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, year, month, day] = dateStr.split('-').map(Number)
    if (month > 12 && day <= 12) {
      // Swapped: interpret as DD/MM → YYYY-MM-DD
      return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`
    }
    return dateStr
  }
  return dateStr
}

interface ParsedReport {
  author: string
  date: string
  completed_tasks: TaskItem[]
  in_progress_tasks: TaskItem[]
  plan_for_tomorrow: string | null
  blockers: string | null
}

function validateResponse(data: unknown): ParsedReport[] {
  if (!Array.isArray(data)) {
    throw new Error('Response is not an array')
  }

  const results: ParsedReport[] = []

  for (const item of data) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Invalid item: not an object`)
    }

    const report = item as Record<string, unknown>

    if (typeof report.author !== 'string' || !report.author.trim()) {
      throw new Error('Missing or empty author field')
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (typeof report.date !== 'string' || !dateRegex.test(report.date)) {
      throw new Error(`Invalid date format: ${report.date}`)
    }

    const completedTasks = Array.isArray(report.completed_tasks)
      ? report.completed_tasks
      : []
    const inProgressTasks = Array.isArray(report.in_progress_tasks)
      ? report.in_progress_tasks
      : []

    const parseTasks = (tasks: unknown[]): TaskItem[] => {
      const result: TaskItem[] = []
      for (const t of tasks) {
        if (typeof t !== 'object' || t === null) continue
        const task = t as Record<string, unknown>
        if (typeof task.description !== 'string') continue
        const hours =
          typeof task.hours === 'number' && task.hours >= 0
            ? task.hours
            : 0
        result.push({ description: task.description.trim(), hours })
      }
      return result
    }

    results.push({
      author: report.author.trim(),
      date: normalizeDate(report.date),
      completed_tasks: parseTasks(completedTasks),
      in_progress_tasks: parseTasks(inProgressTasks),
      plan_for_tomorrow:
        typeof report.plan_for_tomorrow === 'string' &&
        report.plan_for_tomorrow.trim()
          ? report.plan_for_tomorrow.trim()
          : null,
      blockers:
        typeof report.blockers === 'string' && report.blockers.trim()
          ? report.blockers.trim()
          : null,
    })
  }

  return results
}

// ── Edge Function ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth check ───────────────────────────────────────────────────────────
    const user = validateAuth(req)
    if (!user) {
      return new Response(
        JSON.stringify({ code: 401, error: 'Invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json()
    const { text } = body as { text?: string }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Tham số "text" là bắt buộc và phải là string không rỗng.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Call OpenAI API ─────────────────────────────────────────────────────
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      console.error('[ai-parse] OPENAI_API_KEY not set')
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please set OPENAI_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55_000) // 55s < function timeout

    let openaiResponse: Response
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 8192,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.trim() },
          ],
        }),
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('[ai-parse] OpenAI API error:', errorText)
      return new Response(
        JSON.stringify({
          error: 'AI service returned an error. Please try again.',
          detail: `HTTP ${openaiResponse.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Parse and validate response ─────────────────────────────────────────
    const rawData = await openaiResponse.json() as {
      choices?: Array<{ message: { content: string } }>
      error?: { message: string }
    }

    if (rawData.error) {
      console.error('[ai-parse] OpenAI error block:', rawData.error)
      return new Response(
        JSON.stringify({ error: rawData.error.message ?? 'AI service error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const responseText = rawData.choices?.[0]?.message?.content?.trim()

    if (!responseText) {
      throw new Error('Empty response from AI service')
    }

    // Strip markdown code block wrappers if present
    let jsonText = responseText
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }

    // ── Parse JSON ───────────────────────────────────────────────────────────
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      // Partial parse: try to extract first array in the text
      const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
      if (!arrayMatch) {
        throw new Error('AI response is not valid JSON and no array found')
      }
      try {
        parsed = JSON.parse(arrayMatch[0])
      } catch {
        throw new Error('AI response is not valid JSON (tried markdown strip and array extract)')
      }
    }

    // ── Validate with schema ─────────────────────────────────────────────────
    let reports: ParsedReport[]
    try {
      reports = validateResponse(parsed)
    } catch (validationError) {
      console.error('[ai-parse] Validation error:', validationError)
      return new Response(
        JSON.stringify({
          error: 'AI parse failed schema validation',
          detail: validationError instanceof Error ? validationError.message : String(validationError),
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ reports }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[ai-parse] Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    const isAbort = message.includes('aborted') || message.includes('abort')

    return new Response(
      JSON.stringify({
        error: isAbort
          ? 'AI request timed out. Please try with shorter text or reduce complexity.'
          : message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
