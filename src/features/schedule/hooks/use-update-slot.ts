import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

/**
 * useUpdateSlot — mutation hook để cập nhật một slot riêng lẻ với lý do bắt buộc
 *
 * Dùng cho:
 * - Edit unlocked slot (isEmergencyOverride = false)
 * - Emergency Override trên locked slot (isEmergencyOverride = true)
 *
 * Gọi RPC update_slot_with_reason (atomic: update + audit + notify managers)
 */
export function useUpdateSlot(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      slotId,
      newStartTimeUTC,
      newDurationMinutes,
      reason,
      isEmergencyOverride,
    }: {
      slotId: string
      newStartTimeUTC: Date
      newDurationMinutes: number
      reason: string
      isEmergencyOverride?: boolean
    }) =>
      ScheduleService.updateSlotWithReason(
        slotId,
        newStartTimeUTC,
        newDurationMinutes,
        reason,
        isEmergencyOverride ?? false
      ),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isEmergencyOverride
          ? 'Emergency Override thành công'
          : 'Đã cập nhật ca làm việc'
      )
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể cập nhật: ' + error.message)
    },
  })
}
