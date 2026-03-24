import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type Notification = Tables<'notifications'>

export const NotificationsService = {
  getNotifications: async (
    tenantId: string,
    userId: string
  ): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data ?? []
  },

  getUnreadCount: async (
    tenantId: string,
    userId: string
  ): Promise<number> => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
    return count ?? 0
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    if (error) throw error
  },

  markAllAsRead: async (tenantId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
  },
}
