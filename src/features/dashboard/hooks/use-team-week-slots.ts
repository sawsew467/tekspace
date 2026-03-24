import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useTenantStore } from '@/stores/tenant-store'
import { DashboardService } from '../services/dashboard.service'

/**
 * useTeamWeekSlots — lấy tất cả schedule_slots của toàn team cho một tuần.
 *
 * - Trả về [] nếu tuần chưa có schedule_week record (không ai đăng ký).
 * - staleTime 1 phút: schedule team ít thay đổi trong session.
 * - activeTenantId nằm trong query key để cache không bị dùng chung giữa các tenant.
 */
export function useTeamWeekSlots(weekOf: string) {
  const { activeTenantId } = useTenantStore()

  return useQuery({
    queryKey: [QUERY_KEYS.teamSchedule, activeTenantId, weekOf],
    queryFn: () => DashboardService.getTeamWeekSlots(weekOf, activeTenantId!),
    staleTime: 60 * 1000,
    enabled: !!weekOf && !!activeTenantId,
  })
}
