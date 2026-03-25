import { format, subDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'
import { computeStreak } from '@/features/daily-report/schemas/daily-report.schema'

const STREAK_DAYS = 90 // cover streak dài nhất hợp lý (~3 tháng làm việc liên tiếp)

/**
 * useSelfStreak — số ngày báo cáo liên tiếp của member hiện tại.
 * Fetch STREAK_DAYS gần nhất từ daily_reports, compute streak bằng computeStreak (workday-aware).
 * RLS: member chỉ đọc được reports của mình (daily_reports_select_policy).
 *
 * Dates tính bên trong queryFn (không freeze tại mount) để tránh stale sau midnight:
 * - endDate = today tính lại mỗi lần query chạy
 * - refetchOnWindowFocus đảm bảo refresh khi user quay lại tab sau nửa đêm
 *
 * computeStreak logic (workday-aware):
 * - T7/CN không nộp → bỏ qua (không phá streak)
 * - T7/CN có nộp → tính vào streak
 * - Ngày thường không nộp → dừng streak
 * - Streak = 0 nếu hôm nay chưa nộp
 */
export function useSelfStreak() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  return useQuery({
    queryKey: [QUERY_KEYS.selfStreak, activeTenantId, user?.id],
    queryFn: async (): Promise<number> => {
      // Tính dates tại thời điểm execute để không bị stale sau midnight
      const today = format(new Date(), 'yyyy-MM-dd')
      const startDate = format(subDays(new Date(), STREAK_DAYS - 1), 'yyyy-MM-dd')
      const reports = await AnalyticsService.getMemberReportsForPeriod(
        activeTenantId!,
        user!.id,
        startDate,
        today,
      )
      const reportDates = reports.map(r => r.report_date)
      return computeStreak(reportDates, today)
    },
    enabled: !!activeTenantId && !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
