import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

/**
 * Subscribe trực tiếp tới INSERT trên bảng incident_appeals.
 * Khi member submit appeal → invalidate incidentAppeals cache của manager ngay lập tức,
 * không phụ thuộc vào notification delivery chain.
 *
 * Yêu cầu: incident_appeals phải có trong supabase_realtime publication
 * (migration 20260325000008_realtime_incident_appeals.sql)
 */
export function useIncidentAppealsRealtime(tenantId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tenantId) return

    const channel = supabase
      .channel(`incident-appeals-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incident_appeals',
        },
        (payload) => {
          // Client-side tenant filter — chỉ invalidate khi appeal thuộc tenant đang active
          const row = payload.new as { tenant_id?: string }
          if (row.tenant_id !== tenantId) return

          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
          })
        }
      )
      .subscribe((status, err) => {
        if (import.meta.env.DEV) {
          if (status === 'CHANNEL_ERROR') {
            // eslint-disable-next-line no-console
            console.error('[Realtime] incident-appeals channel error:', err)
          } else {
            // eslint-disable-next-line no-console
            console.log(`[Realtime] incident-appeals channel status: ${status}`)
          }
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])
}
