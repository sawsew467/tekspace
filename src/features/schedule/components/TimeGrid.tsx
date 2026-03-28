import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ScheduleSlot } from '../services/schedule.service'
import {
  getSlotEditMode,
  formatSlotTime,
  formatSlotDuration,
  snapTo30,
  minutesToTimeString, // P9: reuse from utils — removes duplicate minutesToTimeLabel
} from '../utils/schedule.utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DragCreateParams {
  date: string            // 'YYYY-MM-DD'
  startMinutes: number    // minutes from midnight (snapped to 30)
  durationMinutes: number // snapped to 30, min 30
}

interface DragState {
  date: string
  startMinutes: number      // snapped
  currentEndMinutes: number // snapped, always >= startMinutes + 30
  pointerId: number
}

interface TimeGridProps {
  slots: ScheduleSlot[]
  weekOf: string                            // Monday 'YYYY-MM-DD'
  userTimezone: string
  onAddSlot: (date: string) => void         // fallback (không dùng trực tiếp trong grid)
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  onDragCreate: (params: DragCreateParams) => void
  isDeletingSlotId?: string
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TOTAL_MINUTES = 1440 // 24 * 60

// P1: Drag position capped at 23:30 so snapTo30 never returns 1440 (off-grid)
// and the minimum 30-min ghost always fits within the 1440px column height.
const MAX_DRAG_MINUTES = TOTAL_MINUTES - 30 // 1410 = 23:30

function slotToPosition(slot: ScheduleSlot, userTimezone: string) {
  const startUtc = new Date(slot.start_time)
  const startInUserTz = toZonedTime(startUtc, userTimezone)
  const startMinutes = startInUserTz.getHours() * 60 + startInUserTz.getMinutes()
  return {
    top: startMinutes,
    // P4: clamp height so overnight slots (e.g. 23:00 + 120min) don't overflow the grid
    height: Math.min(slot.duration_minutes, TOTAL_MINUTES - startMinutes),
  }
}

// ── DayColumn ─────────────────────────────────────────────────────────────────

interface DayColumnProps {
  date: string               // 'YYYY-MM-DD'
  dayName: string            // 'T2'
  dateFormatted: string      // '23/03'
  slots: ScheduleSlot[]
  isLocked: boolean
  isToday: boolean
  userTimezone: string
  currentTimeTop: number     // px position of current time indicator
  dragState: DragState | null
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, date: string, el: HTMLDivElement) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>, el: HTMLDivElement) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
}

// P8: memo ensures DayColumn only re-renders when its own props change,
// making the useCallback wrappers in TimeGrid actually effective during drag.
const DayColumn = memo(function DayColumn({
  date,
  dayName,
  dateFormatted,
  slots,
  isLocked,
  isToday,
  userTimezone,
  currentTimeTop,
  dragState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onEditSlot,
  onDeleteSlot,
  isDeletingSlotId,
}: DayColumnProps) {
  const colRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!colRef.current) return
      onPointerDown(e, date, colRef.current)
    },
    [date, onPointerDown],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!colRef.current) return
      onPointerMove(e, colRef.current)
    },
    [onPointerMove],
  )

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border/50 pb-1 pt-1 text-center select-none">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {dayName}
        </p>
        <p className={cn('text-xs', isToday && 'text-primary font-semibold')}>
          {dateFormatted}
        </p>
      </div>

      {/* Column body: relative container for slot blocks */}
      <div
        ref={colRef}
        className={cn(
          'relative border-r border-border/20 select-none overflow-hidden',
          isLocked ? 'cursor-default' : 'cursor-crosshair',
        )}
        style={{ height: TOTAL_MINUTES }}
        onPointerDown={isLocked ? undefined : handlePointerDown}
        onPointerMove={isLocked ? undefined : handlePointerMove}
        onPointerUp={isLocked ? undefined : onPointerUp}
        onPointerCancel={isLocked ? undefined : onPointerCancel}
      >
        {/* Locked overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-muted/30 opacity-60 pointer-events-none z-10" />
        )}

        {/* Hour grid lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: h * 60 }}
          />
        ))}

        {/* 30-min grid lines */}
        {HOURS.map((h) => (
          <div
            key={`half-${h}`}
            className="absolute left-0 right-0 border-t border-border/10"
            style={{ top: h * 60 + 30 }}
          />
        ))}

        {/* Current time indicator (today column only) */}
        {isToday && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: currentTimeTop }}
          >
            <div className="relative flex items-center">
              <div className="h-2 w-2 rounded-full bg-red-400 -ml-1 flex-shrink-0" />
              <div className="h-px flex-1 bg-red-400" />
            </div>
          </div>
        )}

        {/* Slot blocks */}
        {slots.map((slot) => {
          const pos = slotToPosition(slot, userTimezone)
          const editMode = getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)
          const isDeleting = isDeletingSlotId === slot.id
          const canEdit = editMode !== 'locked'
          return (
            <div
              data-slot-block
              key={slot.id}
              className={cn(
                'absolute left-[2px] right-[2px] rounded-md px-1.5 py-1 text-xs z-10 group',
                'bg-primary/80 text-primary-foreground transition-colors',
                canEdit ? 'hover:bg-primary cursor-pointer' : 'opacity-50 cursor-default',
                isDeleting && 'opacity-40',
              )}
              style={{ top: pos.top, height: Math.max(pos.height, 20) }}
            >
              {/* Time text — click to edit */}
              <div
                className="leading-tight"
                onClick={(e) => {
                  e.stopPropagation()
                  if (canEdit) onEditSlot(slot.id)
                }}
              >
                <p className="font-medium tabular-nums truncate">
                  {formatSlotTime(slot.start_time, slot.duration_minutes, userTimezone)}
                </p>
                {pos.height >= 40 && (
                  <p className="text-xs opacity-80">{formatSlotDuration(slot.duration_minutes)}</p>
                )}
              </div>

              {/* Action buttons — xuất hiện khi hover (chỉ khi không locked) */}
              {canEdit && (
                <div
                  className={cn(
                    'absolute top-0.5 right-0.5 flex gap-0.5',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                  )}
                >
                  <button
                    type="button"
                    aria-label="Chỉnh sửa slot"
                    className="rounded p-0.5 hover:bg-white/20 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditSlot(slot.id)
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Xóa slot"
                    className="rounded p-0.5 hover:bg-red-500/30 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSlot(slot.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Drag ghost preview */}
        {dragState && (
          <div
            className="absolute left-[2px] right-[2px] rounded-md border-2 border-dashed border-primary bg-primary/15 px-1.5 py-1 text-xs z-30 pointer-events-none"
            style={{
              top: dragState.startMinutes,
              height: Math.max(dragState.currentEndMinutes - dragState.startMinutes, 30),
            }}
          >
            {/* P9: use minutesToTimeString from utils (was duplicated as minutesToTimeLabel) */}
            <p className="font-medium tabular-nums leading-tight text-primary">
              {minutesToTimeString(dragState.startMinutes)} → {minutesToTimeString(dragState.currentEndMinutes)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

// ── TimeGrid ──────────────────────────────────────────────────────────────────

/**
 * TimeGrid — time-grid 24h cho desktop (>= 768px)
 *
 * AC3: 1440px tall (60px/hour = 1px/min), auto-scroll to current time on mount
 * AC4: Slot blocks positioned by UTC→userTz conversion
 * AC5: Current time red line on today's column
 * AC6: Locked day columns (opacity overlay, no drag)
 * AC7: Drag-to-create with 30-min snap and ghost preview
 * AC8: onDragCreate called with snapped params on pointerup
 */
export function TimeGrid({
  slots,
  weekOf,
  userTimezone,
  onEditSlot,
  onDeleteSlot,
  onDragCreate,
  isDeletingSlotId,
  className,
}: TimeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  // P3: distinguishes a real drag (pointerDown + move) from a bare click (pointerDown + up)
  const hasDragged = useRef(false)

  // P10: memoize weekDays — stable reference for slotsByDate/isLockedByDate deps
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(parseISO(weekOf), i)
        const dateStr = format(date, 'yyyy-MM-dd')
        const dayName = format(date, 'EEE', { locale: vi }).toUpperCase()
        const dateFormatted = format(date, 'dd/MM')
        return { date: dateStr, dayName, dateFormatted }
      }),
    [weekOf],
  )

  // Today ISO date string (in user timezone)
  const now = new Date()
  const nowInUserTz = toZonedTime(now, userTimezone)
  const todayStr = format(nowInUserTz, 'yyyy-MM-dd')
  const currentTimeTop = nowInUserTz.getHours() * 60 + nowInUserTz.getMinutes()

  // P10+P11: group slots by date AND pre-compute isLocked per column in a single pass.
  // Avoids recomputing on every render and eliminates 7× getSlotEditMode calls per frame during drag.
  const { slotsByDate, isLockedByDate } = useMemo(() => {
    const byDate: Record<string, ScheduleSlot[]> = {}
    const locked: Record<string, boolean> = {}
    for (const { date } of weekDays) {
      byDate[date] = slots.filter((s) => s.slot_date === date)
      locked[date] = getSlotEditMode(date, undefined, userTimezone) === 'locked'
    }
    return { slotsByDate: byDate, isLockedByDate: locked }
  }, [slots, weekDays, userTimezone])

  // Auto-scroll to current time on mount (AC3)
  useEffect(() => {
    if (!containerRef.current) return
    const currentMinutes = nowInUserTz.getHours() * 60 + nowInUserTz.getMinutes()
    const scrollTarget = currentMinutes < 8 * 60 ? 8 * 60 : currentMinutes
    containerRef.current.scrollTop = Math.max(scrollTarget - 100, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // P7: container-level pointercancel clears dragState even if scroll intercepts the event
  // before it reaches the column div (e.g. system gesture, two-finger scroll on trackpad).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onCancel = () => setDragState(null)
    container.addEventListener('pointercancel', onCancel)
    return () => container.removeEventListener('pointercancel', onCancel)
  }, [])

  // Pointer handlers for drag-to-create (AC7)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, date: string, columnEl: HTMLDivElement) => {
      // Ignore clicks on existing slot blocks (let slot click bubble)
      if ((e.target as Element).closest('[data-slot-block]')) return

      const rect = columnEl.getBoundingClientRect()
      const scrollTop = containerRef.current?.scrollTop ?? 0
      const y = e.clientY - rect.top + scrollTop
      // P1: clamp to MAX_DRAG_MINUTES (23:30) so snapTo30 never returns 1440 (off-grid)
      const rawMinutes = Math.min(Math.max(0, y), MAX_DRAG_MINUTES)
      const snapped = snapTo30(rawMinutes)

      hasDragged.current = false // P3: reset drag flag for each new gesture
      columnEl.setPointerCapture(e.pointerId)
      setDragState({
        date,
        startMinutes: snapped,
        currentEndMinutes: snapped + 30,
        pointerId: e.pointerId,
      })
    },
    [],
  )

  // P5: functional updater removes dragState from deps, preventing handler recreation
  // on every state update during drag (was causing all 7 DayColumns to re-render per move).
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnEl: HTMLDivElement) => {
      const rect = columnEl.getBoundingClientRect()
      const scrollTop = containerRef.current?.scrollTop ?? 0
      const y = e.clientY - rect.top + scrollTop
      // P1: consistent clamp with handlePointerDown
      const rawMinutes = Math.min(Math.max(0, y), MAX_DRAG_MINUTES)
      const snappedEnd = snapTo30(rawMinutes)
      setDragState((prev) => {
        if (!prev) return null
        hasDragged.current = true // P3: mark that a real drag occurred
        return { ...prev, currentEndMinutes: Math.max(snappedEnd, prev.startMinutes + 30) }
      })
    },
    [], // no deps — reads dragState via functional updater
  )

  const handlePointerUp = useCallback(() => {
    if (!dragState) return
    // P3: bare click (no pointer movement) → dismiss ghost, do NOT open SlotForm
    if (!hasDragged.current) {
      setDragState(null)
      return
    }
    const duration = dragState.currentEndMinutes - dragState.startMinutes
    if (duration >= 30) {
      onDragCreate({
        date: dragState.date,
        startMinutes: dragState.startMinutes,
        durationMinutes: duration,
      })
    }
    setDragState(null)
  }, [dragState, onDragCreate])

  const handlePointerCancel = useCallback(() => {
    setDragState(null)
  }, [])

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {/* Scrollable container: time axis + 7 day columns */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto flex"
        style={{ minHeight: 0 }}
      >
        {/* Time axis: sticky left */}
        <div className="w-12 flex-shrink-0 relative" style={{ height: TOTAL_MINUTES }}>
          {/* Sticky spacer for column headers */}
          <div className="sticky top-0 z-20 bg-background h-[44px] border-b border-border/50" />
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground tabular-nums select-none"
              style={{ top: h * 60 - 6, lineHeight: '12px' }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* 7 day columns */}
        <div className="grid grid-cols-7 flex-1 min-w-0">
          {weekDays.map(({ date, dayName, dateFormatted }) => {
            // P11: use pre-computed isLocked (calculated once in useMemo, not per render)
            const isLocked = isLockedByDate[date] ?? false
            const isToday = date === todayStr
            const dayDragState = dragState?.date === date ? dragState : null

            return (
              <DayColumn
                key={date}
                date={date}
                dayName={dayName}
                dateFormatted={dateFormatted}
                slots={slotsByDate[date] ?? []}
                isLocked={isLocked}
                isToday={isToday}
                userTimezone={userTimezone}
                currentTimeTop={currentTimeTop}
                dragState={dayDragState}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onEditSlot={onEditSlot}
                onDeleteSlot={onDeleteSlot}
                isDeletingSlotId={isDeletingSlotId}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
