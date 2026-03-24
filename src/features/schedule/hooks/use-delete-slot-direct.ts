import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

/**
 * useDeleteSlotDirect — Tier 3 direct delete (không cần reason, không notify manager)
 *
 * Dùng khi slot thuộc Tier 3 (free): slot_date >= next Monday theo user timezone.
 * RLS policy `schedule_slots_delete_policy` cho phép user_id = auth.uid() delete trực tiếp.
 *
 * @param weekId Schedule week ID để invalidate query cache
 */
export function useDeleteSlotDirect(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ slotId }: { slotId: string }) => {
      const { error } = await supabase
        .from('schedule_slots')
        .delete()
        .eq('id', slotId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã xóa ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể xóa: ' + error.message)
    },
  })
}
