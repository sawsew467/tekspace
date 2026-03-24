import { addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { Plus, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { type ScheduleSlot } from '../services/schedule.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSlotTime(startTime: string, durationMinutes: number, timezone: string): string {
  const start = toZonedTime(new Date(startTime), timezone)
  const endMs = new Date(startTime).getTime() + durationMinutes * 60 * 1000
  const end = toZonedTime(new Date(endMs), timezone)
  return `${formatTz(start, 'HH:mm', { timeZone: timezone })} – ${formatTz(end, 'HH:mm', { timeZone: timezone })}`
}

function formatSlotDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}p`
  if (m === 0) return `${h}h`
  return `${h}h${m}p`
}

function totalWeekHours(slots: ScheduleSlot[]): number {
  return slots.reduce((sum, s) => sum + s.duration_minutes, 0) / 60
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ScheduleSlot
  userTimezone: string
  onDelete: (slotId: string) => void
  isDeleting?: boolean
}

function SlotCard({ slot, userTimezone, onDelete, isDeleting }: SlotCardProps) {
  return (
    <div className="group flex items-start justify-between rounded-md border bg-card p-2 text-sm shadow-sm hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium tabular-nums leading-tight">
            {formatSlotTime(slot.start_time, slot.duration_minutes, userTimezone)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSlotDuration(slot.duration_minutes)}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={() => onDelete(slot.id)}
        disabled={isDeleting}
        aria-label="Xóa slot"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── DayColumn (desktop) ───────────────────────────────────────────────────────

interface DayColumnProps {
  date: string          // "YYYY-MM-DD"
  dayLabel: string      // "Thứ Hai 23/03"
  slots: ScheduleSlot[]
  userTimezone: string
  onAddSlot: (date: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
}

function DayColumn({
  date,
  dayLabel,
  slots,
  userTimezone,
  onAddSlot,
  onDeleteSlot,
  isDeletingSlotId,
}: DayColumnProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight whitespace-pre-wrap text-center">
          {dayLabel}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[80px]">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            userTimezone={userTimezone}
            onDelete={onDeleteSlot}
            isDeleting={isDeletingSlotId === slot.id}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs"
          onClick={() => onAddSlot(date)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── DayRow (mobile) ───────────────────────────────────────────────────────────

interface DayRowProps extends Omit<DayColumnProps, 'isDeletingSlotId'> {
  isDeletingSlotId?: string
}

function DayRow({
  date,
  dayLabel,
  slots,
  userTimezone,
  onAddSlot,
  onDeleteSlot,
  isDeletingSlotId,
}: DayRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{dayLabel}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => onAddSlot(date)}
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm
        </Button>
      </div>
      {slots.length > 0 ? (
        <div className="space-y-1.5 pl-3 border-l-2 border-muted">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              userTimezone={userTimezone}
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
  onAddSlot: (date: string) => void   // truyền ngày để pre-fill form
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
  className?: string
}

/**
 * ScheduleGrid — hiển thị lịch tuần dạng grid (desktop) hoặc list (mobile)
 *
 * Desktop (>= 768px): 7 cột Mon–Sun
 * Mobile (< 768px):   list theo ngày
 */
export function ScheduleGrid({
  slots,
  weekOf,
  userTimezone,
  onAddSlot,
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
    const dayLabel = isMobile
      ? format(date, 'EEEE dd/MM', { locale: vi })
      : format(date, 'EEE\ndd/MM', { locale: vi })
    return { date: dateStr, dayLabel }
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
                onDeleteSlot={onDeleteSlot}
                isDeletingSlotId={isDeletingSlotId}
              />
            ))}
          </div>
        ) : (
          // Desktop: 7-column grid
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map(({ date, dayLabel }) => (
              <DayColumn
                key={date}
                date={date}
                dayLabel={dayLabel}
                slots={slotsByDate[date] ?? []}
                userTimezone={userTimezone}
                onAddSlot={onAddSlot}
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
