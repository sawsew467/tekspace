import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-browser'
import type { AiParseResponse } from '../types/ai-parse.types'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-parse`

async function callAiParse(text: string): Promise<AiParseResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  if (!accessToken) {
    throw new Error('Unauthorized — no active session')
  }

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
}

export function useAiParse(options?: {
  onSuccess?: (data: AiParseResponse) => void
  onError?: (error: Error) => void
}) {
  return useMutation({
    mutationFn: callAiParse,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
