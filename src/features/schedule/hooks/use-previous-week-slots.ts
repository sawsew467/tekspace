import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

/**
 * usePreviousWeekSlots — lấy schedule_slots của user từ tuần trước
 * KHÔNG tạo schedule_week record mới nếu chưa tồn tại.
 * staleTime cao hơn (5 phút) vì dữ liệu tuần trước ít thay đổi.
 */
export function usePreviousWeekSlots(previousWeekOf: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.scheduleSlots, 'previous', previousWeekOf],
    queryFn: () => ScheduleService.getPreviousWeekSlots(previousWeekOf),
    staleTime: 5 * 60 * 1000,   // 5 phút — tuần trước ít thay đổi
    enabled: !!previousWeekOf,
  })
}
