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
 * - options.refetchInterval: truyền 60_000 khi cần auto-refresh (e.g. "who is online").
 */
export function useTeamWeekSlots(weekOf: string, options?: { refetchInterval?: number }) {
  const { activeTenantId } = useTenantStore()

  return useQuery({
    queryKey: [QUERY_KEYS.teamSchedule, activeTenantId, weekOf],
    queryFn: () => DashboardService.getTeamWeekSlots(weekOf, activeTenantId!),
    staleTime: options?.refetchInterval != null ? 0 : 60 * 1000,
    refetchInterval: options?.refetchInterval,
    enabled: !!weekOf && !!activeTenantId,
  })
}
