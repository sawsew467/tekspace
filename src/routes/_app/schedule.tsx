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
import { shiftSlotsToCurrentWeek } from '@/features/schedule/utils/schedule.utils'
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

  // Story 2.3: Edit/Delete dialog state
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<ScheduleSlot | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // P-2: tách riêng emergency flag cho edit và delete để tránh bleed giữa 2 dialogs
  const [editIsEmergency, setEditIsEmergency] = useState(false)
  const [deleteIsEmergency, setDeleteIsEmergency] = useState(false)

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

  // Story 2.3: Update slot với reason (edit + emergency override)
  const updateSlot = useUpdateSlot(scheduleWeek?.id)

  // Story 2.3: Delete slot với reason (thay thế direct delete)
  const deleteSlotWithReason = useDeleteSlotWithReason(scheduleWeek?.id)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function findSlot(slotId: string): ScheduleSlot | null {
    return slots.find((s) => s.id === slotId) ?? null
  }

  // ── Handlers: Add slot (giữ nguyên từ Story 2.1) ──────────────────────────

  function handleAddSlot(_date: string) {
    setSlotFormOpen(true)
  }

  function handleAddSlotSubmit(values: SlotFormValues) {
    if (!scheduleWeek || !activeTenantId) return

    // Guard: không submit khi profile đang loading (userTimezone có thể là 'UTC' fallback sai) (P13)
    if (isProfileLoading) {
      toast.error('Đang tải thông tin người dùng, vui lòng đợi...')
      return
    }

    // Guard: không submit khi đang có mutation khác in-flight (P12: stale snapshot race)
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

  // ── Handlers: Apply template (giữ nguyên từ Story 2.2) ───────────────────

  function handleApplyTemplate() {
    if (!scheduleWeek || isUpsertPending) return
    const shiftedSlots = shiftSlotsToCurrentWeek(previousSlots, tenantTimezone)
    upsertMutate(
      { weekId: scheduleWeek.id, slots: shiftedSlots },
      { onSuccess: () => toast.success('Đã tải lịch từ tuần trước làm template') }
    )
  }

  // ── Handlers: Story 2.3 — Edit/Delete/Emergency ───────────────────────────

  function handleEditSlot(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    setEditingSlot(slot)
    setEditIsEmergency(false)
    setEditDialogOpen(true)
  }

  function handleDeleteSlot(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    setDeletingSlot(slot)
    setDeleteIsEmergency(false)
    setDeleteDialogOpen(true)
  }

  function handleEmergencyOverride(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    setEditingSlot(slot)
    setEditIsEmergency(true)
    setEditDialogOpen(true)
  }

  function handleEmergencyDelete(slotId: string) {
    const slot = findSlot(slotId)
    if (!slot) return
    setDeletingSlot(slot)
    setDeleteIsEmergency(true)
    setDeleteDialogOpen(true)
  }

  function handleEditSubmit(data: {
    newStartTimeUTC: Date
    newDurationMinutes: number
    reason: string
    isEmergency: boolean
  }) {
    if (!editingSlot) return
    updateSlot.mutate(
      {
        slotId: editingSlot.id,
        newStartTimeUTC: data.newStartTimeUTC,
        newDurationMinutes: data.newDurationMinutes,
        reason: data.reason,
        isEmergencyOverride: data.isEmergency,
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false)
          setEditingSlot(null) // P-4: clear stale reference để tránh form pre-fill cũ khi mở lại
        },
      }
    )
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

  // Banner template: hiện khi tuần đang xem trống và tuần trước có data.
  // User chủ động quyết định có tải template hay không (không auto-apply).
  const showTemplateBanner =
    !isLoading &&
    !!scheduleWeek &&
    !scheduleWeek.is_locked &&
    slots.length === 0 &&
    previousSlots.length > 0

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Title + week navigation */}
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Lịch làm việc</h1>
            <div className="flex items-center gap-0.5 mt-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handlePrevWeek}
                title="Tuần trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums px-1">
                {format(parseISO(currentWeekOf), 'dd/MM')}
                {' – '}
                {format(addDays(parseISO(currentWeekOf), 6), 'dd/MM/yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleNextWeek}
                title="Tuần sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
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
          </div>
        </div>

        {/* Right side: deadline badge + add button */}
        <div className="flex items-center gap-3 flex-wrap">
          {scheduleWeek && !isWeekLoading ? (
            <ScheduleDeadlineBadge
              deadline={scheduleWeek.deadline}
              userTimezone={userTimezone}
            />
          ) : (
            <Skeleton className="h-6 w-48" />
          )}

          {/* Add slot button — disabled khi upsert in-flight (P12: prevent stale snapshot race) */}
          <Button
            onClick={() => handleAddSlot(currentWeekOf)}
            disabled={isLoading || scheduleWeek?.is_locked || upsertSlots.isPending}
            size="sm"
          >
            + Thêm ca làm việc
          </Button>
        </div>
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
          onEmergencyOverride={handleEmergencyOverride}
          onEmergencyDelete={handleEmergencyDelete}
          isDeletingSlotId={
            deleteSlotWithReason.isPending
              ? deletingSlot?.id
              : undefined
          }
        />
      )}

      {/* Slot form dialog — Add slot (Story 2.1) */}
      <SlotForm
        open={slotFormOpen}
        onOpenChange={setSlotFormOpen}
        weekOf={currentWeekOf}
        existingSlots={slots}
        onSubmit={handleAddSlotSubmit}
        isLoading={upsertSlots.isPending}
        userTimezone={userTimezone}
        tenantTimezone={tenantTimezone}
      />

      {/* Story 2.3: Edit slot dialog (unlocked edit + emergency override) */}
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
          isEmergency={editIsEmergency}
          isLoading={updateSlot.isPending}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Story 2.3: Delete slot dialog (unlocked + emergency delete) */}
      {/* P-5: null guard — chỉ render khi deletingSlot đã được set */}
      {deletingSlot && (
        <DeleteSlotDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          slot={deletingSlot}
          userTimezone={userTimezone}
          isEmergency={deleteIsEmergency}
          isLoading={deleteSlotWithReason.isPending}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
