import { corsHeaders } from '../_shared/cors.ts'

// TODO: Implement remove-member logic in Epic 1 stories (Story 1.6)
// This stub returns 200 OK to allow the project to build

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
