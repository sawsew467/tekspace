import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase-browser'
import { useTenantStore } from '@/stores/tenant-store'

export type TeamAvgResult = {
  member_count: number
  avg_rate: number | null
}

/**
 * useTeamAvgCommitment — gọi RPC get_team_avg_commitment_rate để lấy
 * average commitment rate của những thành viên KHÁC (exclude caller) đã submit tuần này.
 *
 * Returns: { member_count, avg_rate }
 * - member_count = số người KHÁC đã submit ít nhất 1 report trong tuần (không tính caller)
 * - avg_rate = trung bình rate của những người đó (NULL nếu không có ai submit)
 * - showComparison khi member_count >= 4 — đảm bảo đủ ẩn danh
 *
 * staleTime 5 phút — aggregate ít thay đổi.
 */
export function useTeamAvgCommitment(weekStart: string, weekEnd: string) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.teamAvgCommitment, activeTenantId, weekStart, weekEnd],
    queryFn: async (): Promise<TeamAvgResult> => {
      const { data, error } = await supabase.rpc('get_team_avg_commitment_rate', {
        p_week_start: weekStart,
        p_week_end: weekEnd,
      })
      if (error) throw error
      return data as TeamAvgResult
    },
    enabled: !!activeTenantId && !!weekStart,
    staleTime: 5 * 60_000,
  })
}
