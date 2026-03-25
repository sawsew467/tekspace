import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

/**
 * useDeleteSlotWithReason — mutation hook để xóa một slot riêng lẻ với lý do bắt buộc
 *
 * Dùng cho:
 * - Delete unlocked slot (isEmergencyOverride = false)
 * - Emergency delete trên locked slot (isEmergencyOverride = true)
 *
 * Gọi RPC delete_slot_with_reason (atomic: notify managers in-app + delete)
 * Sau RPC thành công: fire-and-forget email notification tới managers (Story 6.4)
 */
export function useDeleteSlotWithReason(weekId: string | undefined, tenantId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      slotId,
      reason,
      isEmergencyOverride,
    }: {
      slotId: string
      reason: string
      isEmergencyOverride?: boolean
    }) =>
      ScheduleService.deleteSlotWithReason(slotId, reason, isEmergencyOverride ?? false, tenantId),
    onSuccess: () => {
      toast.success('Đã xóa ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể xóa: ' + error.message)
    },
  })
}
