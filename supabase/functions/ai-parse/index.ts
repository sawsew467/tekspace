import { corsHeaders } from '../_shared/cors.ts'
import { getUserFromJwt } from '../_shared/jwt.ts'

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Bạn là AI assistant chuyên parse daily standup reports từ các nền tảng chat (Slack, Discord, MS Teams, v.v.) thành structured JSON.

Nhiệm vụ:
1. Đọc raw text input — đây là export từ một buổi daily standup meeting
2. Trích xuất danh sách các báo cáo ngày (daily reports), mỗi report gồm:
   - Người viết (author): tên hoặc username hiển thị trong chat
   - Ngày (date): ngày của standup, format YYYY-MM-DD
   - Tasks đã hoàn thành (completed_tasks): mảng các task, mỗi task gồm description + giờ làm (hours, số)
   - Tasks đang làm (in_progress_tasks): mảng các task đang tiến hành, mỗi task gồm description + giờ làm (hours, số)
   - Plan for tomorrow (plan_for_tomorrow): string mô tả kế hoạch ngày mai
   - Blockers (blockers): string mô tả khó khăn/g障碍 (hoặc null nếu không có)

Quy tắc xử lý:
- **Hours calculation**: Tổng hours_logged = tổng tất cả hours của completed_tasks + in_progress_tasks. Nếu không có task nào → hours_logged = 0.
- **N/A or empty sections**: Bỏ qua không tạo task row cho section trống hoặc "N/A"
- **Date detection**: Nếu text không chứa ngày cụ thể, dùng ngày hôm nay làm report_date
- **Flexible format**: Xử lý được nhiều format khác nhau: Slack thread format, Discord export, MS Teams export, Google Chat export, hoặc raw text đơn giản
- **Multiple dates**: Nếu input chứa reports của nhiều ngày, trả về tất cả
- **Author extraction**: Trích xuất tên người viết từ message header/prefix. Giữ nguyên tên gốc (có thể chứa tiếng Việt, emoji, @mentions)
- **Task parsing**: Tách description và hours từ mỗi task line. Nếu hours không được đề cập rõ ràng, đoán hợp lý (thường 1-4 giờ).

Trả về JSON array, mỗi object có cấu trúc:
{
  "author": "Tên người viết",
  "date": "YYYY-MM-DD",
  "completed_tasks": [
    { "description": "Mô tả task", "hours": 2 }
  ],
  "in_progress_tasks": [
    { "description": "Mô tả task đang làm", "hours": 3 }
  ],
  "plan_for_tomorrow": "Kế hoạch ngày mai hoặc null",
  "blockers": "Khó khăn hoặc null"
}

Trả về DUY NHẤT JSON array, không kèm markdown code block, không giải thích thêm.`

// ── Response Schema (Zod-like validation) ────────────────────────────────────

interface TaskItem {
  description: string
  hours: number
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
      date: report.date,
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
    const user = getUserFromJwt(req.headers.get('Authorization'))
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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
          max_tokens: 4096,
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
