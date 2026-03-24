import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

/**
 * useUpdateSlotDirect — Tier 3 direct update (không cần reason, không notify manager)
 *
 * Dùng khi slot thuộc Tier 3 (free): slot_date >= next Monday theo user timezone.
 *
 * ⚠️ MUST update slot_date cùng với start_time.
 *    DB trigger `validate_slot_date` fires on UPDATE và sẽ throw exception
 *    nếu slot_date không khớp với ngày của start_time theo tenant timezone.
 *
 * @param weekId Schedule week ID để invalidate query cache
 */
export function useUpdateSlotDirect(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      slotId,
      newStartTimeUTC,
      newDurationMinutes,
      tenantTimezone,
    }: {
      slotId: string
      newStartTimeUTC: Date
      newDurationMinutes: number
      tenantTimezone: string
    }) => {
      // Tính slot_date mới từ start_time UTC theo tenant timezone
      // (giống convertSlotToUTC — DB trigger validate theo tenant timezone)
      const newSlotDate = format(
        toZonedTime(newStartTimeUTC, tenantTimezone),
        'yyyy-MM-dd',
      )

      const { error } = await supabase
        .from('schedule_slots')
        .update({
          start_time: newStartTimeUTC.toISOString(),
          duration_minutes: newDurationMinutes,
          slot_date: newSlotDate,  // ← BẮT BUỘC, DB trigger validate_slot_date
        })
        .eq('id', slotId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã cập nhật ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể cập nhật: ' + error.message)
    },
  })
}
