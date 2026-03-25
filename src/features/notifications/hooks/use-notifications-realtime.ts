import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'
import { playNotificationSound } from '@/features/notifications/utils/notification-sound'

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
          const row = payload.new as { tenant_id?: string; type?: string; message?: string }
          if (row.tenant_id !== tenantId) return

          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.notifications, tenantId],
          })

          // Khi có incident mới → invalidate incidents list để page tự cập nhật
          if (row.type === 'incident_logged') {
            queryClient.invalidateQueries({
              queryKey: [QUERY_KEYS.incidents, tenantId],
            })
          }

          // Khi manager nhận appeal_submitted → invalidate appeals để hiển thị ngay
          if (row.type === 'appeal_submitted') {
            queryClient.invalidateQueries({
              queryKey: [QUERY_KEYS.incidentAppeals, tenantId],
            })
          }

          // Âm thanh ping — luôn phát khi có notification mới (bất kể tab state)
          playNotificationSound()

          // Browser Notification — chỉ khi granted VÀ tab không active
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.visibilityState !== 'visible'
          ) {
            const body =
              typeof row.message === 'string' && row.message.trim()
                ? row.message
                : 'Bạn có thông báo mới'
            try {
              new Notification('TekSpace', {
                body,
                icon: '/favicon.ico',
              })
            } catch {
              // Silent fail — permission có thể bị revoke mid-session
            }
          }
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
