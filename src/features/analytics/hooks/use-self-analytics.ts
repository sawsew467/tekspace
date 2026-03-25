import { useAuthStore } from '@/stores/auth-store'
import { useMemberTrend } from '@/features/analytics/hooks/use-member-trend'

/**
 * useSelfAnalytics — lấy weekly hours trend của chính member đang đăng nhập.
 * Reuses useMemberTrend với user.id — RLS đảm bảo chỉ đọc được data của chính mình.
 */
export function useSelfAnalytics(startDate: string, endDate: string) {
  const { user } = useAuthStore()
  return useMemberTrend(user?.id ?? null, startDate, endDate)
}
