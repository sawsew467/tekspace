import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { startOfISOWeek, format, parseISO, addDays } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useScheduleWeek } from '@/features/schedule/hooks/use-schedule-week'
import { useScheduleSlots } from '@/features/schedule/hooks/use-schedule-slots'
import { useUpsertSlots } from '@/features/schedule/hooks/use-upsert-slots'
import { usePreviousWeekSlots } from '@/features/schedule/hooks/use-previous-week-slots'
import { useUpdateSlot } from '@/features/schedule/hooks/use-update-slot'
import { useDeleteSlotWithReason } from '@/features/schedule/hooks/use-delete-slot-with-reason'
import { useUpdateSlotDirect } from '@/features/schedule/hooks/use-update-slot-direct'
import { useDeleteSlotDirect } from '@/features/schedule/hooks/use-delete-slot-direct'
import { ScheduleGrid, ScheduleGridSkeleton } from '@/features/schedule/components/ScheduleGrid'
import { ScheduleDeadlineBadge } from '@/features/schedule/components/ScheduleDeadlineBadge'
import { SlotForm } from '@/features/schedule/components/SlotForm'
import { EditSlotDialog } from '@/features/schedule/components/EditSlotDialog'
import { DeleteSlotDialog } from '@/features/schedule/components/DeleteSlotDialog'
import {
  ScheduleService,
  convertSlotToUTC,
  type ScheduleSlot,
} from '@/features/schedule/services/schedule.service'
import { shiftSlotsToCurrentWeek, getSlotEditMode, type SlotEditMode } from '@/features/schedule/utils/schedule.utils'
import type { SlotFormValues } from '@/features/schedule/schemas/schedule.schema'

export const Route = createFileRoute('/_app/schedule')({
  head: () => ({
    meta: [{ title: 'Lịch làm việc — TekSpace' }],
  }),
  component: SchedulePage,
})

function getCurrentWeekOf(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
}

function SchedulePage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // currentWeekOf: tuần đang xem (navigable, mặc định là tuần hiện tại)
  // Focus listener: cập nhật về tuần thực khi tuần mới bắt đầu trong lúc app nền
  const [currentWeekOf, setCurrentWeekOf] = useState(getCurrentWeekOf)
  useEffect(() => {
    const checkWeekChange = () => {
      const newWeek = getCurrentWeekOf()
      setCurrentWeekOf((prev) => (prev !== newWeek ? newWeek : prev))
    }
    window.addEventListener('focus', checkWeekChange)
    return () => window.removeEventListener('focus', checkWeekChange)
  }, [])

  // todayWeekOf: tuần thực tế hôm nay — dùng để hiện nút "Về tuần này"
  const todayWeekOf = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
  const isViewingCurrentWeek = currentWeekOf === todayWeekOf

  const handlePrevWeek = () =>
    setCurrentWeekOf((prev) => format(addDays(parseISO(prev), -7), 'yyyy-MM-dd'))
  const handleNextWeek = () =>
    setCurrentWeekOf((prev) => format(addDays(parseISO(prev), 7), 'yyyy-MM-dd'))
  const handleGoToCurrentWeek = () => setCurrentWeekOf(getCurrentWeekOf())

  // ── UI state ───────────────────────────────────────────────────────────────

  const [slotFormOpen, setSlotFormOpen] = useState(false)
  // AC3: pre-fill date khi click "+" trên một ngày cụ thể
  const [slotFormDefaultDate, setSlotFormDefaultDate] = useState<string | undefined>(undefined)

  // Edit/Delete dialog state
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [editingSlotMode, setEditingSlotMode] = useState<SlotEditMode>('free') // P-6: capture mode lúc open
  const [deletingSlot, setDeletingSlot] = useState<ScheduleSlot | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // ── Data queries ───────────────────────────────────────────────────────────

  // User profile (timezone)
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Tenant timezone
  const { data: tenantTimezone = 'UTC', isLoading: isTenantLoading } = useQuery({
    queryKey: ['tenant-timezone', activeTenantId],
    queryFn: () => ScheduleService.getTenantTimezone(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 10 * 60 * 1000,
  })

  // Schedule week (get or create)
  const { data: scheduleWeek, isLoading: isWeekLoading } = useScheduleWeek(currentWeekOf)

  // Schedule slots
  const { data: slots = [], isLoading: isSlotsLoading } = useScheduleSlots(scheduleWeek?.id)

  // Slots tuần trước — dùng cho banner template thủ công
  const previousWeekOf = format(addDays(parseISO(currentWeekOf), -7), 'yyyy-MM-dd')
  const { data: previousSlots = [], isLoading: isPreviousSlotsLoading } = usePreviousWeekSlots(previousWeekOf)

  const userTimezone = userProfile?.timezone ?? 'UTC'

  // isLoading bao gồm isPreviousSlotsLoading để banner không nhấp nháy khi data còn loading
  const isLoading = isProfileLoading || isTenantLoading || isWeekLoading || isSlotsLoading || isPreviousSlotsLoading

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Upsert mutation (atomic via RPC — dùng cho add slot + apply template)
  const upsertSlots = useUpsertSlots()
  const { mutate: upsertMutate, isPending: isUpsertPending } = upsertSlots

  // Tier 2: Update/Delete slot với reason (hôm nay → Chủ nhật tuần này)
  const updateSlot = useUpdateSlot(scheduleWeek?.id)
  const deleteSlotWithReason = useDeleteSlotWithReason(scheduleWeek?.id)

  // Tier 3: Direct update/delete không cần reason (tuần sau trở đi)
  const updateSlotDirect = useUpdateSlotDirect(scheduleWeek?.id)
  const deleteSlotDirect = useDeleteSlotDirect(scheduleWeek?.id)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function findSlot(slotId: string): ScheduleSlot | null {
    return slots.find((s) => s.id === slotId) ?? null
  }

  // ── Handlers: Add slot ──────────────────────────────────────────────────────

  // AC3: pre-fill date khi click "+" trên column của ngày cụ thể
  function handleAddSlot(date: string) {
    setSlotFormDefaultDate(date)
    setSlotFormOpen(true)
  }

  function handleAddSlotSubmit(values: SlotFormValues) {
    if (!scheduleWeek || !activeTenantId) return

    // Guard: không submit khi profile đang loading (userTimezone có thể là 'UTC' fallback sai)
    if (isProfileLoading) {
      toast.error('Đang tải thông tin người dùng, vui lòng đợi...')
      return
    }

    // Guard: không submit khi đang có mutation khác in-flight
    if (upsertSlots.isPending) return

    const newSlotInput = convertSlotToUTC(values, userTimezone, tenantTimezone)

    // Convert existing slots sang SlotInput format để giữ lại trong upsert
    const existingInputs = slots.map((s) => ({
      slotDate: s.slot_date,
      startTimeUTC: new Date(s.start_time),
      durationMinutes: s.duration_minutes,
    }))

    upsertSlots.mutate(
      { weekId: scheduleWeek.id, slots: [...existingInputs, newSlotInput] },
      {
        onSuccess: () => {
          toast.success('Đã lưu lịch làm việc')
          setSlotFormOpen(false)
        },
      }
    )
  }

  // ── Handlers: Apply template ───────────────────────────────────────────────

  function handleApplyTemplate() {
    if (!scheduleWeek || isUpsertPending) return
    const shiftedSlots = shiftSlotsToCurrentWeek(previousSlots, tenantTimezone)
    upsertMutate(
      { weekId: scheduleWeek.id, slots: shiftedSlots },
      { onSuccess: () => toast.success('Đã tải lịch từ tuần trước làm template') }
    )
  }

  // ── Handlers: 3-tier Edit/Delete (AC5, AC6) ────────────────────────────────

  function handleEditSlot(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    const mode = getSlotEditMode(slot.slot_date, userTimezone)

    if (mode === 'reason-required') {
      // Tier 2: mở EditSlotDialog (cần reason, gọi RPC, manager notified)
      setEditingSlot(slot)
      setEditingSlotMode(mode) // P-6: capture mode lúc mở, tránh race condition midnight
      setEditDialogOpen(true)
    } else if (mode === 'free') {
      // Tier 3: mở EditSlotDialog (reuse dialog, route sang direct update)
      setEditingSlot(slot)
      setEditingSlotMode(mode) // P-6: capture mode lúc mở
      setEditDialogOpen(true)
    }
    // Tier 1 (locked): không làm gì — UI đã không hiển thị button
  }

  function handleDeleteSlot(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    const mode = getSlotEditMode(slot.slot_date, userTimezone)

    if (mode === 'reason-required') {
      // Tier 2: mở DeleteSlotDialog (cần reason, gọi RPC, manager notified)
      setDeletingSlot(slot)
      setDeleteDialogOpen(true)
    } else if (mode === 'free') {
      // Tier 3: direct delete — không cần dialog, không notify manager (AC6)
      deleteSlotDirect.mutate({ slotId })
    }
    // Tier 1 (locked): không làm gì — UI đã không hiển thị button
  }

  function handleEditSubmit(data: {
    newStartTimeUTC: Date
    newDurationMinutes: number
    reason: string
    isEmergency: boolean
  }) {
    if (!editingSlot) return
    // P-6: dùng editingSlotMode đã capture lúc mở dialog, không re-evaluate
    // → tránh race condition khi user submit sau midnight (mode đổi từ free → reason-required)

    if (editingSlotMode === 'free') {
      // Tier 3: direct update — không cần reason, không notify manager (AC6)
      updateSlotDirect.mutate(
        {
          slotId: editingSlot.id,
          newStartTimeUTC: data.newStartTimeUTC,
          newDurationMinutes: data.newDurationMinutes,
          tenantTimezone,
        },
        {
          onSuccess: () => {
            setEditDialogOpen(false)
            setEditingSlot(null)
          },
        }
      )
    } else {
      // Tier 2: RPC với reason bắt buộc, manager được notify
      updateSlot.mutate(
        {
          slotId: editingSlot.id,
          newStartTimeUTC: data.newStartTimeUTC,
          newDurationMinutes: data.newDurationMinutes,
          reason: data.reason,
          isEmergencyOverride: false,
        },
        {
          onSuccess: () => {
            setEditDialogOpen(false)
            setEditingSlot(null)
          },
        }
      )
    }
  }

  function handleDeleteConfirm(data: { reason: string; isEmergency: boolean }) {
    if (!deletingSlot) return
    deleteSlotWithReason.mutate(
      {
        slotId: deletingSlot.id,
        reason: data.reason,
        isEmergencyOverride: data.isEmergency,
      },
      {
        onSuccess: () => setDeleteDialogOpen(false),
      }
    )
  }

  // ── Template banner visibility ────────────────────────────────────────────

  const showTemplateBanner =
    !isLoading &&
    !!scheduleWeek &&
    !scheduleWeek.is_locked &&
    slots.length === 0 &&
    previousSlots.length > 0

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Lịch làm việc</h1>
      </div>

      {/* Week navigation — centered (AC4) */}
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevWeek}
          title="Tuần trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums px-2">
          {format(parseISO(currentWeekOf), 'dd/MM')}
          {' – '}
          {format(addDays(parseISO(currentWeekOf), 6), 'dd/MM/yyyy')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextWeek}
          title="Tuần sau"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isViewingCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700"
            onClick={handleGoToCurrentWeek}
          >
            Tuần này
          </Button>
        )}
      </div>

      {/* Right side: deadline badge + add button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {scheduleWeek && !isWeekLoading ? (
            <ScheduleDeadlineBadge
              deadline={scheduleWeek.deadline}
              userTimezone={userTimezone}
            />
          ) : (
            <Skeleton className="h-6 w-48" />
          )}
        </div>

        {/* Add slot button — disabled khi upsert in-flight */}
        <Button
          onClick={() => handleAddSlot(currentWeekOf)}
          disabled={isLoading || scheduleWeek?.is_locked || upsertSlots.isPending}
          size="sm"
        >
          + Thêm ca làm việc
        </Button>
      </div>

      {/* Locked warning */}
      {scheduleWeek?.is_locked && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Lịch tuần này đã bị khóa sau deadline. Liên hệ quản lý để thay đổi.
        </div>
      )}

      {/* Template banner — user chủ động tải lịch từ tuần trước */}
      {showTemplateBanner && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Tuần trước có <strong>{previousSlots.length}</strong> ca làm việc — dùng làm template cho tuần này?
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyTemplate}
            disabled={isUpsertPending}
          >
            {isUpsertPending ? 'Đang tải...' : 'Tải lịch tuần trước'}
          </Button>
        </div>
      )}

      {/* Schedule grid */}
      {isLoading ? (
        <ScheduleGridSkeleton />
      ) : (
        <ScheduleGrid
          slots={slots}
          weekOf={currentWeekOf}
          userTimezone={userTimezone}
          onAddSlot={handleAddSlot}
          onEditSlot={handleEditSlot}
          onDeleteSlot={handleDeleteSlot}
          isDeletingSlotId={
            deleteSlotWithReason.isPending
              ? deletingSlot?.id
              : deleteSlotDirect.isPending
                ? deleteSlotDirect.variables?.slotId  // P-7: track per-slot spinner cho Tier 3
                : undefined
          }
        />
      )}

      {/* Slot form dialog — Add slot (AC3: defaultDate pre-fill) */}
      <SlotForm
        open={slotFormOpen}
        onOpenChange={setSlotFormOpen}
        weekOf={currentWeekOf}
        defaultDate={slotFormDefaultDate}
        existingSlots={slots}
        onSubmit={handleAddSlotSubmit}
        isLoading={upsertSlots.isPending}
        userTimezone={userTimezone}
        tenantTimezone={tenantTimezone}
      />

      {/* Edit slot dialog — Tier 2 (reason required) + Tier 3 (direct via handleEditSubmit routing) */}
      {/* key={editingSlot.id} — force remount khi slot thay đổi để useForm reset defaultValues đúng */}
      {editingSlot && (
        <EditSlotDialog
          key={editingSlot.id}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          slot={editingSlot}
          existingSlots={slots}
          weekOf={currentWeekOf}
          userTimezone={userTimezone}
          tenantTimezone={tenantTimezone}
          isEmergency={false}
          requireReason={editingSlotMode === 'reason-required'} // P-6: dùng captured mode
          isLoading={updateSlot.isPending || updateSlotDirect.isPending}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Delete slot dialog — Tier 2 only (Tier 3 direct delete không dùng dialog) */}
      {deletingSlot && (
        <DeleteSlotDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          slot={deletingSlot}
          userTimezone={userTimezone}
          isEmergency={false}
          isLoading={deleteSlotWithReason.isPending}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
