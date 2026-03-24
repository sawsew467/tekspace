import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService, type SlotInput } from '../services/schedule.service'

/**
 * useUpsertSlots — submit toàn bộ lịch tuần (atomic via RPC upsert_week_slots)
 */
export function useUpsertSlots() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ weekId, slots }: { weekId: string; slots: SlotInput[] }) => {
      return ScheduleService.upsertWeekSlots(weekId, slots)
    },
    onSuccess: (_, { weekId }) => {
      // Toast được handle tại call site — mỗi nơi gọi có message phù hợp context
      // (template apply: "Đã tải lịch từ tuần trước", manual save: "Đã lưu lịch làm việc")
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      // Overlay overlap detection message từ DB trigger
      if (error.message.includes('overlap') || error.message.includes('chồng lấp')) {
        toast.error('Thời gian này bị trùng với slot khác.')
      } else if (error.message.includes('khóa') || error.message.includes('locked')) {
        toast.error('Lịch tuần này đã bị khóa, không thể thay đổi.')
      } else {
        toast.error('Không thể lưu lịch: ' + error.message)
      }
    },
  })
}
