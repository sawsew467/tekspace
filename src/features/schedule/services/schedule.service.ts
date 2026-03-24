import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'
import { type SlotFormValues, calcDurationMinutes } from '../schemas/schedule.schema'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export type ScheduleWeek = Tables<'schedule_weeks'>
export type ScheduleSlot = Tables<'schedule_slots'>

// ── SlotInput: dữ liệu đã được convert sang UTC, sẵn sàng insert vào DB ──────

export interface SlotInput {
  slotDate: string           // YYYY-MM-DD — ngày trong TENANT timezone
  startTimeUTC: Date         // UTC absolute time
  durationMinutes: number    // 30–720
}

// ── Tính toán UTC start_time và slot_date từ user input ──────────────────────

export function convertSlotToUTC(
  values: SlotFormValues,
  userTimezone: string,
  tenantTimezone: string
): SlotInput {
  const durationMinutes = calcDurationMinutes(values)

  // Convert user-selected datetime (in user timezone) → UTC
  const localDateTimeStr = `${values.slotDate}T${values.startTime}:00`
  const startTimeUTC = fromZonedTime(localDateTimeStr, userTimezone)

  // slot_date PHẢI tính theo TENANT timezone (bắt buộc — DB trigger validate)
  const slotDate = format(toZonedTime(startTimeUTC, tenantTimezone), 'yyyy-MM-dd')

  return { slotDate, startTimeUTC, durationMinutes }
}

// ── Service object ────────────────────────────────────────────────────────────

export const ScheduleService = {
  // Lấy hoặc tạo schedule_week cho tenant + week_of
  // Members không thể INSERT schedule_weeks trực tiếp (RLS chặn) → dùng RPC SECURITY DEFINER
  getOrCreateScheduleWeek: async (weekOf: string): Promise<ScheduleWeek> => {
    const { data: weekId, error: rpcError } = await supabase.rpc('get_or_create_schedule_week', {
      p_week_of: weekOf,
    })
    if (rpcError) throw rpcError

    const { data: week, error: weekError } = await supabase
      .from('schedule_weeks')
      .select('*')
      .eq('id', weekId as string)
      .single()
    if (weekError) throw weekError
    if (!week) throw new Error('schedule_week không tồn tại sau khi tạo')
    return week
  },

  // Lấy tất cả slots của user hiện tại cho một week
  // Dùng getSession() (cache) thay vì getUser() (network round-trip) để giảm latency
  getWeekSlots: async (weekId: string): Promise<ScheduleSlot[]> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Chưa đăng nhập')

    const { data, error } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', session.user.id)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  // Lấy tenant timezone
  getTenantTimezone: async (tenantId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('tenants')
      .select('timezone')
      .eq('id', tenantId)
      .single()
    if (error) throw error
    if (!data) throw new Error('Tenant không tồn tại')
    return data.timezone
  },

  // Upsert toàn bộ slots cho một week — atomic via RPC upsert_week_slots
  // RPC wrap delete + insert + audit trong 1 plpgsql transaction.
  // tenantId không cần truyền — RPC lấy từ JWT (current_tenant_id()).
  upsertWeekSlots: async (weekId: string, slots: SlotInput[]): Promise<void> => {
    const slotsJson = slots.map((s) => ({
      slot_date: s.slotDate,
      start_time: s.startTimeUTC.toISOString(),
      duration_minutes: s.durationMinutes,
    }))

    const { error } = await supabase.rpc('upsert_week_slots', {
      p_week_id: weekId,
      p_slots: slotsJson,
    })
    if (error) throw error
  },
}
