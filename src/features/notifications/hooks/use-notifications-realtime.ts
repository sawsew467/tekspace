import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useNotificationsRealtime(
  tenantId: string | null,
  userId: string | null
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tenantId || !userId) return

    const channelName = `notifications-${userId}-${tenantId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Client-side tenant filter: chỉ invalidate khi notification thuộc tenant đang active
          const row = payload.new as { tenant_id?: string }
          if (row.tenant_id !== tenantId) return

          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.notifications, tenantId],
          })
        }
      )
      .subscribe((status, err) => {
        if (import.meta.env.DEV) {
          if (status === 'CHANNEL_ERROR') {
            // eslint-disable-next-line no-console
            console.error('[Realtime] notifications channel error:', err)
          } else {
            // eslint-disable-next-line no-console
            console.log(`[Realtime] notifications channel status: ${status}`)
          }
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, userId, queryClient])
}
