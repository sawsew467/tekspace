import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import {
  calcCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
} from '@/features/analytics/utils/analytics.utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: TenantMemberWithUser
  actualHours: number
  defaultCommittedHours: number
  /** Hệ số quy đổi committed hàng tuần sang kỳ đang chọn (week=1, month=#tuần, day=1/5...). */
  committedMultiplier: number
  isSelected: boolean
  onClick: (userId: string) => void
}

// ── MemberRow ──────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  actualHours,
  defaultCommittedHours,
  committedMultiplier,
  isSelected,
  onClick,
}: MemberRowProps) {
  const weeklyCommitted = member.committed_hours ?? defaultCommittedHours
  // Committed của kỳ = committed hàng tuần × hệ số kỳ → mẫu số tỷ lệ đúng theo mức gom.
  const effectiveCommitted = weeklyCommitted * committedMultiplier
  const rate = calcCommitmentRate(actualHours, effectiveCommitted)
  const rateColorClass = getCommitmentRateColorClass(rate)
  const displayName =
    member.users?.full_name ||
    (member.users?.email ? member.users.email.split('@')[0] : 'Member')

  return (
    <tr
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      className={[
        'border-b border-border cursor-pointer transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50',
        isSelected ? 'bg-muted/70' : '',
      ].join(' ')}
      onClick={() => onClick(member.user_id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(member.user_id)
        }
      }}
    >
      {/* Member name + role badge */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{displayName}</span>
          {member.role !== 'member' && (
            <Badge variant="secondary" className="text-xs capitalize">
              {member.role}
            </Badge>
          )}
        </div>
      </td>

      {/* Committed hours (đã quy đổi theo kỳ) */}
      <td className="py-3 px-4 text-sm text-right tabular-nums">
        {Math.round(effectiveCommitted)}h
      </td>

      {/* Actual hours this week */}
      <td className="py-3 px-4 text-sm text-right tabular-nums">
        {actualHours}h
      </td>

      {/* Commitment rate with color indicator */}
      <td className={`py-3 px-4 text-sm text-right tabular-nums ${rateColorClass}`}>
        {formatRate(rate)}
      </td>
    </tr>
  )
}

// ── TeamAnalyticsOverview ──────────────────────────────────────────────────────

interface TeamAnalyticsOverviewProps {
  members: TenantMemberWithUser[]
  /** userId → totalHours trong kỳ đang chọn */
  hoursMap: Map<string, number>
  defaultCommittedHours: number
  /** Hệ số quy đổi committed hàng tuần sang kỳ đang chọn. */
  committedMultiplier: number
  isLoading: boolean
  selectedUserId: string | null
  onSelectMember: (userId: string) => void
}

export function TeamAnalyticsOverview({
  members,
  hoursMap,
  defaultCommittedHours,
  committedMultiplier,
  isLoading,
  selectedUserId,
  onSelectMember,
}: TeamAnalyticsOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
        Chưa có thành viên nào trong team.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full" role="grid" aria-label="Team hours overview">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th
              scope="col"
              className="py-2 px-4 text-left text-xs font-medium text-muted-foreground"
            >
              Thành viên
            </th>
            <th
              scope="col"
              className="py-2 px-4 text-right text-xs font-medium text-muted-foreground"
            >
              Cam kết
            </th>
            <th
              scope="col"
              className="py-2 px-4 text-right text-xs font-medium text-muted-foreground"
            >
              Thực tế
            </th>
            <th
              scope="col"
              className="py-2 px-4 text-right text-xs font-medium text-muted-foreground"
            >
              Tỷ lệ
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              actualHours={hoursMap.get(member.user_id) ?? 0}
              defaultCommittedHours={defaultCommittedHours}
              committedMultiplier={committedMultiplier}
              isSelected={selectedUserId === member.user_id}
              onClick={onSelectMember}
            />
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
        Click vào thành viên để xem trend theo thời gian. Màu đỏ = &lt;70%, vàng = 70–84%.
      </p>
    </div>
  )
}
