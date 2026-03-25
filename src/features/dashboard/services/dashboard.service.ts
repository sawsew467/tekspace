import { supabase } from '@/lib/supabase-browser'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'

export const DashboardService = {
  /**
   * Lấy tất cả schedule_slots của toàn team cho một tuần.
   *
   * - Dùng maybeSingle() để KHÔNG tạo schedule_week mới nếu chưa có.
   *   (Khác với ScheduleService.getOrCreateScheduleWeek dành cho personal schedule)
   * - RLS schedule_slots SELECT: tenant_id = current_tenant_id()
   *   → tự filter theo tenant, trả về slots của tất cả members trong tenant.
   * - tenantId được truyền từ hook để double-check defense-in-depth ngoài RLS.
   * - Nếu tuần chưa có record (không ai đăng ký) → return [].
   */
  getTeamWeekSlots: async (weekOf: string, tenantId: string): Promise<ScheduleSlot[]> => {
    const { data: week, error: weekError } = await supabase
      .from('schedule_weeks')
      .select('id')
      .eq('week_of', weekOf)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (weekError) throw weekError
    if (!week) return []

    const { data, error } = await supabase
      .from('schedule_slots')
      .select('id, user_id, week_id, slot_date, start_time, duration_minutes, tenant_id, created_at, updated_at')
      .eq('week_id', week.id)
      .eq('tenant_id', tenantId)
      .order('user_id', { ascending: true })
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  /**
   * Lấy default_committed_hours từ tenant.
   * Dùng làm fallback khi tenant_members.committed_hours = NULL (Story 3.3).
   */
  getDefaultCommittedHours: async (tenantId: string): Promise<number> => {
    const { data, error } = await supabase
      .from('tenants')
      .select('default_committed_hours')
      .eq('id', tenantId)
      .single()
    if (error) throw error
    return data?.default_committed_hours ?? 40
  },
}
