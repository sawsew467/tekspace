import { format, subDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase-browser'
import { computeStreak } from '@/features/daily-report/schemas/daily-report.schema'

const STREAK_DAYS = 90 // cover streak dài nhất hợp lý (~3 tháng làm việc liên tiếp)

/**
 * useSelfStreak — số ngày báo cáo liên tiếp của member hiện tại.
 * Fetch STREAK_DAYS gần nhất từ daily_reports, compute streak bằng computeStreak (workday-aware).
 * RLS: member chỉ đọc được reports của mình (daily_reports_select_policy).
 *
 * Dùng direct Supabase query (không qua getMemberReportsForPeriod) để:
 * - Chỉ fetch report_date — không cần hours_logged
 * - Tránh isFinite filter bỏ sót reports có hours_logged = null (Bug 9-6 fix)
 *
 * Dates tính bên trong queryFn (không freeze tại mount) để tránh stale sau midnight:
 * - endDate = today tính lại mỗi lần query chạy
 * - refetchOnWindowFocus đảm bảo refresh khi user quay lại tab sau nửa đêm
 *
 * computeStreak logic (workday-aware):
 * - T7/CN không nộp → bỏ qua (không phá streak)
 * - T7/CN có nộp → tính vào streak
 * - Ngày thường không nộp → dừng streak
 * - Nếu hôm nay chưa nộp → tính streak từ ngày làm việc gần nhất
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

      // Direct query: chỉ cần report_date để tính streak — không dùng getMemberReportsForPeriod
      // vì method đó filter isFinite(hours_logged), bỏ sót reports có hours_logged = null
      const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date')
        .eq('tenant_id', activeTenantId!)
        .eq('user_id', user!.id)
        .gte('report_date', startDate)
        .lte('report_date', today)
        .order('report_date', { ascending: true })
        .limit(STREAK_DAYS) // max STREAK_DAYS rows — safe: 90 days × 1 report/day

      if (error) throw error

      const reportDates = (data ?? [])
        .map(r => r.report_date)
        .filter((d): d is string => d !== null)
      return computeStreak(reportDates, today)
    },
    enabled: !!activeTenantId && !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
