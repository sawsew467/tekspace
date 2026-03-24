import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

/**
 * useScheduleSlots — lấy tất cả schedule_slots của user trong một week
 */
export function useScheduleSlots(weekId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.scheduleSlots, weekId],
    queryFn: () => ScheduleService.getWeekSlots(weekId!),
    staleTime: 30 * 1000,   // 30 giây
    enabled: !!weekId,
  })
}
