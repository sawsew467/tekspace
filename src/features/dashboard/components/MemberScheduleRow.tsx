import { addDays, format, parseISO } from 'date-fns'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'
import { getSlotsForDate, formatSlotTimeRange, formatSlotDuration } from '../utils/dashboard.utils'

interface MemberScheduleRowProps {
  member: TenantMemberWithUser
  slots: ScheduleSlot[]
  weekOf: string          // ISO Monday, e.g. "2026-03-23"
  displayTimezone: string // IANA timezone của user đang login
}

/**
 * MemberScheduleRow — hiển thị 1 hàng trong team schedule grid.
 * Cột đầu: tên member. Cột 2–8: T2 đến CN với các slots trong ngày đó.
 */
export function MemberScheduleRow({ member, slots, weekOf, displayTimezone }: MemberScheduleRowProps) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(parseISO(weekOf), i))

  return (
    <tr className="border-b border-border last:border-0">
      {/* Tên member */}
      <td className="py-3 pl-4 pr-3 w-36 align-top">
        <span className="text-sm font-medium leading-none truncate block max-w-[128px]">
          {member.users.full_name}
        </span>
      </td>

      {/* 7 cột ngày T2–CN */}
      {weekDays.map(day => {
        const dateISO = format(day, 'yyyy-MM-dd')
        const daySlots = getSlotsForDate(slots, dateISO)

        return (
          <td key={dateISO} className="py-2 px-1 align-top min-w-[96px]">
            {daySlots.length === 0 ? (
              <span className="text-xs text-muted-foreground/40">—</span>
            ) : (
              <div className="flex flex-col gap-1">
                {daySlots.map(slot => (
                  <div
                    key={slot.id}
                    className="rounded-md bg-muted/60 px-2 py-1.5 text-xs leading-tight"
                  >
                    <div className="font-medium tabular-nums">
                      {formatSlotTimeRange(slot, displayTimezone)}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {formatSlotDuration(slot.duration_minutes)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}
