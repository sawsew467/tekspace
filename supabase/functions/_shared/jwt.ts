/**
 * Decode JWT payload from Authorization header WITHOUT making an HTTP call.
 *
 * WHY: In Supabase local dev, Edge Functions run inside Docker where
 * `SUPABASE_URL` resolves to an internal address (e.g. http://kong:8000).
 * The JWT `iss` claim contains the *external* URL (http://127.0.0.1:54321).
 * Calling `supabaseAdmin.auth.getUser(token)` triggers GoTrue to re-verify
 * the JWT, but GoTrue rejects it because `iss` doesn't match its own URL →
 * "Invalid JWT".
 *
 * SAFE: Supabase Kong gateway verifies the JWT signature *before* routing to
 * Edge Functions. By the time this code runs, the token is already trusted.
 * We only need to extract the payload (sub, email) — not re-verify.
 */
export function getUserFromJwt(
  authHeader: string | null
): { id: string; email: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.slice(7)
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    )
    if (!payload.sub || !payload.email) return null
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}
