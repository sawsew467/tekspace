import { useMemo } from 'react'
import { getTimeRange } from '@/features/analytics/utils/analytics.utils'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'

/**
 * useSelfSparkline — lấy weekly hours 4 tuần gần nhất của member hiện tại.
 * Reuses useSelfAnalytics (→ useMemberTrend → RLS-safe, member chỉ thấy data của mình).
 * Caller dùng data?.weeklyHours để build sparkline data points.
 * staleTime 2 phút (kế thừa từ useMemberTrend).
 */
export function useSelfSparkline() {
  const { startDate, endDate } = useMemo(() => getTimeRange(4), [])
  return useSelfAnalytics(startDate, endDate)
}
