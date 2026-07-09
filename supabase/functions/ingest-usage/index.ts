// Edge Function: ingest-usage
//
// Receives usage snapshots from the ClaudeKit CLI hook (usage-sync.cjs) and
// stores them via the ingest_usage RPC (service_role). Auth is a device token,
// NOT a Supabase JWT — so this function is registered with verify_jwt = false
// and validates the opaque `cku_` token itself (RT-8).
//
// Hardening (RT-7): hard body-size cap + strict field whitelist/validation
// before the token is even looked up; unknown fields are dropped, strings are
// length-capped, numbers are clamped. Invalid/revoked token -> 401.

import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

const MAX_BODY_BYTES = 4096

function sha256Hex(input: string): Promise<string> {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(input))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    )
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function intOrNull(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Whitelist + clamp the client payload; never trust raw client strings/numbers. */
function sanitize(raw: Record<string, unknown>) {
  return {
    session_id: str(raw.session_id, 200),
    model: str(raw.model, 120),
    project_hash: str(raw.project_hash, 64),
    project_name: str(raw.project_name, 200),
    branch: str(raw.branch, 200),
    context_percent: intOrNull(raw.context_percent, 0, 100),
    context_tokens: intOrNull(raw.context_tokens, 0, 100_000_000),
    lines_added: intOrNull(raw.lines_added, 0, 100_000_000),
    lines_removed: intOrNull(raw.lines_removed, 0, 100_000_000),
    five_hour_pct: intOrNull(raw.five_hour_pct, 0, 100),
    seven_day_pct: intOrNull(raw.seven_day_pct, 0, 100),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders })
  }

  // Size cap before reading (RT-7).
  const declared = Number(req.headers.get('content-length') || '0')
  if (declared > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413, headers: corsHeaders })
  }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders })
  }

  let raw: string
  try {
    raw = await req.text()
  } catch {
    return new Response('bad request', { status: 400, headers: corsHeaders })
  }
  if (raw.length > MAX_BODY_BYTES) {
    return new Response('payload too large', { status: 413, headers: corsHeaders })
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Response('bad request', { status: 400, headers: corsHeaders })
  }
  if (!parsed || typeof parsed !== 'object') {
    return new Response('bad request', { status: 400, headers: corsHeaders })
  }

  const payload = sanitize(parsed)

  try {
    const tokenHash = await sha256Hex(token)
    const { data, error } = await supabaseAdmin.rpc('ingest_usage', {
      p_token_hash: tokenHash,
      p_payload: payload,
    })
    if (error) {
      // Do not leak internals to the client; log server-side.
      console.error('[ingest-usage] rpc error:', error.message)
      return new Response('server error', { status: 500, headers: corsHeaders })
    }
    if (data !== true) {
      return new Response('unauthorized', { status: 401, headers: corsHeaders })
    }
    return new Response('ok', { status: 200, headers: corsHeaders })
  } catch (e) {
    console.error('[ingest-usage] error:', (e as Error).message)
    return new Response('server error', { status: 500, headers: corsHeaders })
  }
})
