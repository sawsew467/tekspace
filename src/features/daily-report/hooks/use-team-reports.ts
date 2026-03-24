import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getMembers } from '@/features/tenant/services/tenant.service'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

/**
 * Lấy tất cả reports của team cho một ngày cụ thể.
 * Query key phân biệt với useTodayReport: { date } (không có userId).
 * Truyền tenantId=null để disable query (khi user không phải manager).
 */
export function useTeamReports(tenantId: string | null, date: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { date }],
    queryFn: () => DailyReportService.getTeamReportsForDate(tenantId!, date),
    enabled: !!tenantId && !!date,
    staleTime: 30_000, // 30s — manager view không cần realtime
  })
}

/**
 * Lấy danh sách active members của tenant.
 * Reuse getMembers từ tenant.service.ts — không viết lại.
 * Truyền tenantId=null để disable query (khi user không phải manager).
 */
export function useActiveMembers(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, tenantId],
    queryFn: () => getMembers(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 phút — member list ít thay đổi
  })
}
