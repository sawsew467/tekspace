import { addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { type ScheduleSlot } from '../services/schedule.service'
import { getSlotEditMode, formatSlotTime, formatSlotDuration, type SlotEditMode } from '../utils/schedule.utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

// formatSlotTime và formatSlotDuration được import từ schedule.utils.ts (tái dùng trong TimeGrid)

function totalWeekHours(slots: ScheduleSlot[]): number {
  return slots.reduce((sum, s) => sum + s.duration_minutes, 0) / 60
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ScheduleSlot
  userTimezone: string
  editMode: SlotEditMode         // 3-tier: locked | reason-required | free
  onEdit: (slotId: string) => void
  onDelete: (slotId: string) => void
  isDeleting?: boolean
}

function SlotCard({
  slot,
  userTimezone,
  editMode,
  onEdit,
  onDelete,
  isDeleting,
}: SlotCardProps) {
  const timeStr = formatSlotTime(slot.start_time, slot.duration_minutes, userTimezone)
  const durationStr = formatSlotDuration(slot.duration_minutes)

  // Tier 1 — LOCKED: same layout, disabled buttons
  if (editMode === 'locked') {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border bg-card p-2 text-sm opacity-50">
        <p className="font-medium tabular-nums">{timeStr}</p>
        <p className="text-xs text-muted-foreground">{durationStr}</p>
        <div className="flex gap-1.5 mt-1">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 flex-1"
            disabled
            aria-label="Chỉnh sửa slot"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 flex-1 text-destructive"
            disabled
            aria-label="Xóa slot"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  // Tier 2 (reason-required) và Tier 3 (free): cùng layout, chỉ khác handler ở route level
  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-2 text-sm shadow-sm hover:border-primary/50 transition-colors">
      <p className="font-medium tabular-nums">{timeStr}</p>
      <p className="text-xs text-muted-foreground">{durationStr}</p>
      <div className="flex gap-1.5 mt-1">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 flex-1"
          onClick={() => onEdit(slot.id)}
          disabled={isDeleting}
          aria-label="Chỉnh sửa slot"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 flex-1 text-destructive hover:text-destructive"
          onClick={() => onDelete(slot.id)}
          disabled={isDeleting}
          aria-label="Xóa slot"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ── DayColumn (desktop) ───────────────────────────────────────────────────────

interface DayColumnProps {
  date: string          // "YYYY-MM-DD"
  dayName: string       // "T2" (short weekday)
  dateFormatted: string // "23/03"
  slots: ScheduleSlot[]
  userTimezone: string
  onAddSlot: (date: string) => void
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
}

function DayColumn({
  date,
  dayName,
  dateFormatted,
  slots,
  userTimezone,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  isDeletingSlotId,
}: DayColumnProps) {
  const dayLocked = getSlotEditMode(date, userTimezone) === 'locked'

  return (
    <div className="flex flex-col gap-2">
      {/* Header: dayName and date as separate elements — no concatenation (AC2) */}
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {dayName}
        </p>
        <p className="text-xs text-muted-foreground">
          {dateFormatted}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[80px]">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            userTimezone={userTimezone}
            editMode={getSlotEditMode(slot.slot_date, userTimezone)}
            onEdit={onEditSlot}
            onDelete={onDeleteSlot}
            isDeleting={isDeletingSlotId === slot.id}
          />
        ))}
        {/* Ẩn nút "+" cho ngày đã qua — không thể thêm slot vào quá khứ */}
        {!dayLocked && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs"
            onClick={() => onAddSlot(date)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── DayRow (mobile) ───────────────────────────────────────────────────────────

interface DayRowProps {
  date: string
  dayLabel: string       // "Thứ Hai 23/03" (full label for mobile)
  slots: ScheduleSlot[]
  userTimezone: string
  onAddSlot: (date: string) => void
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
}

function DayRow({
  date,
  dayLabel,
  slots,
  userTimezone,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  isDeletingSlotId,
}: DayRowProps) {
  const dayLocked = getSlotEditMode(date, userTimezone) === 'locked'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{dayLabel}</p>
        {/* Ẩn nút "+" cho ngày đã qua */}
        {!dayLocked && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => onAddSlot(date)}
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        )}
      </div>
      {slots.length > 0 ? (
        <div className="space-y-1.5 pl-3 border-l-2 border-muted">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              userTimezone={userTimezone}
              editMode={getSlotEditMode(slot.slot_date, userTimezone)}
              onEdit={onEditSlot}
              onDelete={onDeleteSlot}
              isDeleting={isDeletingSlotId === slot.id}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground pl-3 italic">Chưa có ca nào</p>
      )}
    </div>
  )
}

// ── ScheduleGrid ──────────────────────────────────────────────────────────────

interface ScheduleGridProps {
  slots: ScheduleSlot[]
  weekOf: string           // Monday "YYYY-MM-DD"
  userTimezone: string
  onAddSlot: (date: string) => void
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
  className?: string
}

/**
 * ScheduleGrid — hiển thị lịch tuần dạng grid (desktop) hoặc list (mobile)
 *
 * Desktop (>= 768px): 7 cột Mon–Sun
 * Mobile (< 768px):   list theo ngày
 *
 * Story 2.5: 3-tier SlotCard, bỏ emergency flow, column header fix.
 */
export function ScheduleGrid({
  slots,
  weekOf,
  userTimezone,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  isDeletingSlotId,
  className,
}: ScheduleGridProps) {
  const isMobile = useIsMobile()

  // Generate 7 ngày trong tuần
  // Dùng parseISO() thay vì new Date() để tránh UTC-midnight timezone offset issue
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(parseISO(weekOf), i)
    const dateStr = format(date, 'yyyy-MM-dd')
    // Desktop: tách thành 2 phần riêng để không bị concatenate (AC2)
    const dayName = format(date, 'EEE', { locale: vi }).toUpperCase()
    const dateFormatted = format(date, 'dd/MM')
    // Mobile: full label
    const dayLabel = format(date, 'EEEE dd/MM', { locale: vi })
    return { date: dateStr, dayName, dateFormatted, dayLabel }
  })

  // Group slots by slot_date
  const slotsByDate = weekDays.reduce<Record<string, ScheduleSlot[]>>((acc, { date }) => {
    acc[date] = slots.filter((s) => s.slot_date === date)
    return acc
  }, {})

  const totalHours = totalWeekHours(slots)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Lịch tuần này</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tổng:{' '}
            <span className="font-semibold text-foreground">
              {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} giờ
            </span>
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {isMobile ? (
          // Mobile: list theo ngày
          <div className="space-y-4">
            {weekDays.map(({ date, dayLabel }) => (
              <DayRow
                key={date}
                date={date}
                dayLabel={dayLabel}
                slots={slotsByDate[date] ?? []}
                userTimezone={userTimezone}
                onAddSlot={onAddSlot}
                onEditSlot={onEditSlot}
                onDeleteSlot={onDeleteSlot}
                isDeletingSlotId={isDeletingSlotId}
              />
            ))}
          </div>
        ) : (
          // Desktop: 7-column grid
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map(({ date, dayName, dateFormatted }) => (
              <DayColumn
                key={date}
                date={date}
                dayName={dayName}
                dateFormatted={dateFormatted}
                slots={slotsByDate[date] ?? []}
                userTimezone={userTimezone}
                onAddSlot={onAddSlot}
                onEditSlot={onEditSlot}
                onDeleteSlot={onDeleteSlot}
                isDeletingSlotId={isDeletingSlotId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ScheduleGridSkeleton() {
  const isMobile = useIsMobile()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          // Mobile skeleton: list theo ngày
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-7 w-14" />
                </div>
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : (
          // Desktop skeleton: 7-column grid
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
