import { addDays, format, isValid, parseISO } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'
import {
  buildCellUserMap,
  computeDisplayRange,
  getHeatmapBgClass,
  getInitials,
} from '../utils/dashboard.utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP = 0.5   // 30 phút — khớp bội số 30 phút của schedule form

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const MAX_AVATARS_SHOWN = 4

function formatTimeLabel(h: number): string {
  const hh = String(Math.floor(h)).padStart(2, '0')
  const mm = h % 1 === 0 ? '00' : '30'
  return `${hh}:${mm}`
}

// ── MemberAvatar ──────────────────────────────────────────────────────────────

function MemberAvatar({ member }: { member: TenantMemberWithUser }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className="size-5 ring-1 ring-background shrink-0 cursor-default">
          {member.users.avatar_url && (
            <AvatarImage src={member.users.avatar_url} alt={member.users.full_name} />
          )}
          <AvatarFallback className="text-[9px] font-medium">
            {getInitials(member.users.full_name)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{member.users.full_name}</TooltipContent>
    </Tooltip>
  )
}

// ── HeatmapCell ───────────────────────────────────────────────────────────────

interface HeatmapCellProps {
  userIds: string[]
  memberMap: Map<string, TenantMemberWithUser>
  isHalfHour: boolean
}

function HeatmapCell({ userIds, memberMap, isHalfHour }: HeatmapCellProps) {
  // Lọc ra chỉ những user còn trong team (memberMap) để count và hiển thị chính xác
  // Tránh trường hợp member rời team nhưng slot cũ vẫn còn trong DB
  const validUserIds = userIds.filter(uid => memberMap.has(uid))
  const count = validUserIds.length
  const bgClass = getHeatmapBgClass(count)
  const borderClass = isHalfHour
    ? 'border-b border-b-border/20 border-r border-r-border/40'
    : 'border-b border-b-border/40 border-r border-r-border/40'

  if (count === 0) {
    return <td className={`h-7 ${borderClass}`} />
  }

  const shown = validUserIds.slice(0, MAX_AVATARS_SHOWN)
  const overflow = count - shown.length

  return (
    <td className={`h-7 px-0.5 align-middle ${bgClass} ${borderClass}`}>
      <div className="flex flex-wrap gap-[2px] items-center justify-center">
        {shown.map(uid => {
          const member = memberMap.get(uid)
          if (!member) return null
          return <MemberAvatar key={uid} member={member} />
        })}
        {overflow > 0 && (
          <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-300 leading-none">
            +{overflow}
          </span>
        )}
      </div>
    </td>
  )
}

// ── TeamScheduleHeatmap ───────────────────────────────────────────────────────

interface TeamScheduleHeatmapProps {
  members: TenantMemberWithUser[]
  slots: ScheduleSlot[]
  weekOf: string
  displayTimezone: string
}

/**
 * TeamScheduleHeatmap — lịch team dạng heatmap theo khung giờ.
 *
 * Hàng = mỗi 30 phút. Cột = 7 ngày trong tuần.
 * Ô = avatars của members có slot overlap khung giờ đó (tính theo displayTimezone).
 *
 * Overnight slots được xử lý đúng:
 * - computeDisplayRange mở rộng range để cover cả giờ đêm (ví dụ 22:00–00:00) và
 *   sáng sớm hôm sau (00:00–06:00) khi có overnight slots trong tuần.
 * - buildCellUserMap phân phối avatar sang đúng ngày (ngày bắt đầu VÀ ngày kết thúc).
 *
 * Ràng buộc từ SlotForm:
 * - Start time: 00:00–23:30 (toàn bộ 24h, bước 30 phút)
 * - Overnight end time: capped tại 06:00 (OVERNIGHT_END_OPTIONS trong SlotForm.tsx)
 * - Duration: 30 phút – 720 phút (12 giờ)
 */
export function TeamScheduleHeatmap({
  members,
  slots,
  weekOf,
  displayTimezone,
}: TeamScheduleHeatmapProps) {
  // P-5: Guard — weekOf phải là ISO date hợp lệ
  const weekStart = parseISO(weekOf)
  if (!isValid(weekStart)) return null

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Dynamic range: expand to cover all actual slot times incl. overnight
  const [slotStart, slotEnd] = computeDisplayRange(slots, displayTimezone)

  // All 30-min row keys in the computed range
  const rowSlots = Array.from(
    { length: Math.round((slotEnd - slotStart) / STEP) },
    (_, i) => slotStart + i * STEP,
  )

  const memberMap = new Map<string, TenantMemberWithUser>(
    members.map(m => [m.user_id, m])
  )

  const cellMap = buildCellUserMap(slots, displayTimezone, slotStart, slotEnd, STEP)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse table-fixed">
        {/* Explicit column widths: time label col + 7 equal day cols */}
        <colgroup>
          <col className="w-12" />
          {weekDays.map((_, i) => (
            <col key={i} />
          ))}
        </colgroup>

        {/* Header */}
        <thead>
          <tr className="bg-muted/50">
            <th className="border-b border-r border-border/40 py-2 px-1 text-left text-[11px] font-medium text-muted-foreground">
              Giờ
            </th>
            {weekDays.map((day, i) => (
              <th
                key={i}
                className="border-b border-r border-border/40 py-1.5 px-0 text-center text-[11px] font-medium text-muted-foreground"
              >
                <div className="font-semibold">{DAY_LABELS[i]}</div>
                <div className="text-muted-foreground/60 tabular-nums">{format(day, 'dd/MM')}</div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rowSlots.map(h => {
            const isHalfHour = h % 1 !== 0
            const isHour     = !isHalfHour

            return (
              <tr key={h} className={isHour ? 'bg-background' : 'bg-muted/10'}>
                {/* Time label — hiện ở :00, ẩn ở :30 */}
                <td
                  className={[
                    'border-r border-border/40 px-1 align-middle whitespace-nowrap',
                    'text-[10px] tabular-nums font-medium text-muted-foreground',
                    isHalfHour
                      ? 'border-b border-b-border/20 text-muted-foreground/40'
                      : 'border-b border-b-border/40',
                  ].join(' ')}
                >
                  {isHour ? formatTimeLabel(h) : ''}
                </td>

                {/* 7 day cells */}
                {weekDays.map((day) => {
                  const dateISO = format(day, 'yyyy-MM-dd')
                  const key     = `${dateISO}:${h}`
                  const userIds = cellMap.get(key) ?? []
                  return (
                    <HeatmapCell
                      key={dateISO}
                      userIds={userIds}
                      memberMap={memberMap}
                      isHalfHour={isHalfHour}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
