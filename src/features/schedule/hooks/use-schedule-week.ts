import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

/**
 * useScheduleWeek — lấy hoặc tạo schedule_week cho một week_of (Monday ISO date)
 * Members không thể trực tiếp tạo schedule_weeks → service dùng RPC SECURITY DEFINER
 */
export function useScheduleWeek(weekOf: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.scheduleWeeks, weekOf],
    queryFn: () => ScheduleService.getOrCreateScheduleWeek(weekOf),
    staleTime: 5 * 60 * 1000,   // 5 phút — deadline ít thay đổi
    enabled: !!weekOf,
  })
}
