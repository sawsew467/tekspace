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
import { TimeGrid, type DragCreateParams } from '@/features/schedule/components/TimeGrid'
import { WeekPickerPopover } from '@/features/schedule/components/WeekPickerPopover'
import { ScheduleDeadlineBadge } from '@/features/schedule/components/ScheduleDeadlineBadge'
import { SlotForm } from '@/features/schedule/components/SlotForm'
import { EditSlotDialog } from '@/features/schedule/components/EditSlotDialog'
import { DeleteSlotDialog } from '@/features/schedule/components/DeleteSlotDialog'
import {
  ScheduleService,
  convertSlotToUTC,
  type ScheduleSlot,
} from '@/features/schedule/services/schedule.service'
import { shiftSlotsToCurrentWeek, getSlotEditMode, minutesToTimeString, type SlotEditMode } from '@/features/schedule/utils/schedule.utils'
import type { SlotFormValues } from '@/features/schedule/schemas/schedule.schema'
import { PageContainer } from '@/components/layout/page-container'
import { useIsMobile } from '@/hooks/use-mobile'

export const Route = createFileRoute('/_app/my-schedule')({
  head: () => ({
    meta: [{ title: 'Lịch làm việc — TekSpace' }],
  }),
  component: SchedulePage,
})

const SESSION_KEY = 'teksiyam_last_week'

function getCurrentWeekOf(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
}

function getInitialWeekOf(): string {
  // Ưu tiên sessionStorage để giữ lại week đã chọn khi switch tab
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) return saved
  }
  return getCurrentWeekOf()
}

function SchedulePage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()
  const isMobile = useIsMobile()

  // currentWeekOf: tuần đang xem (navigable, mặc định = saved week hoặc tuần hiện tại)
  const [currentWeekOf, setCurrentWeekOf] = useState(getInitialWeekOf)

  // Persist vào sessionStorage mỗi khi user navigate
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, currentWeekOf)
  }, [currentWeekOf])

  // Focus listener: chỉ auto-reset về tuần hiện tại KHI user đang xem đúng tuần đó
  // → handle crossing midnight (tuần mới bắt đầu trong lúc app nền)
  // → KHÔNG reset khi user đã navigate sang tuần khác
  useEffect(() => {
    const todayWeekOf = getCurrentWeekOf()
    const checkWeekChange = () => {
      const newToday = getCurrentWeekOf()
      if (newToday !== todayWeekOf) {
        // Tuần thực đã thay đổi (crossed midnight / new week started)
        if (currentWeekOf === todayWeekOf) {
          // User đang xem tuần cũ → advance lên tuần mới
          setCurrentWeekOf(newToday)
        }
        // User đang xem tuần khác → không làm gì, giữ nguyên lựa chọn
      }
    }
    window.addEventListener('focus', checkWeekChange)
    return () => window.removeEventListener('focus', checkWeekChange)
  }, [currentWeekOf])

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
  // AC8: pre-fill start/end time khi drag-to-create trên TimeGrid
  const [dragCreateDefaults, setDragCreateDefaults] = useState<{
    startTime: string
    endTime: string
  } | null>(null)

  // Edit/Delete dialog state
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [editingSlotMode, setEditingSlotMode] = useState<SlotEditMode>('free') // P-6: capture mode lúc open
  const [deletingSlotMode, setDeletingSlotMode] = useState<SlotEditMode>('free') // P-6: capture mode lúc open
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
  // activeTenantId truyền để trigger fire-and-forget email notification (Story 6.4)
  const updateSlot = useUpdateSlot(scheduleWeek?.id, activeTenantId ?? undefined)
  const deleteSlotWithReason = useDeleteSlotWithReason(scheduleWeek?.id, activeTenantId ?? undefined)

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
    setDragCreateDefaults(null)
    setSlotFormOpen(true)
  }

  // AC8: drag-to-create → mở SlotForm pre-filled với start/end time từ drag
  function handleDragCreate({ date, startMinutes, durationMinutes }: DragCreateParams) {
    // P2: clamp endMinutes tới 23:30 max để tránh endTime='00:00' gây blank Select trong SlotForm
    // (TIME_OPTIONS chỉ có 00:00–23:30, filter t > startTime loại '00:00' nếu startTime gần midnight)
    const MAX_END_MINUTES = 23 * 60 + 30 // 1410 = 23:30
    const endMinutes = Math.min(startMinutes + durationMinutes, MAX_END_MINUTES)
    const startTime = minutesToTimeString(startMinutes)
    const endTime = minutesToTimeString(endMinutes)
    setSlotFormDefaultDate(date)
    setDragCreateDefaults({ startTime, endTime })
    setSlotFormOpen(true)
  }

  // Reset drag defaults khi form đóng
  function handleSlotFormOpenChange(open: boolean) {
    setSlotFormOpen(open)
    if (!open) setDragCreateDefaults(null)
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
    const mode = getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)

    if (mode === 'started' || mode === 'reason-required') {
      // Tier started: Emergency Override dialog; Tier 2: regular edit dialog (cần reason, gọi RPC)
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
    const mode = getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)

    if (mode === 'started' || mode === 'reason-required') {
      // Tier started: Emergency Override dialog; Tier 2: mở DeleteSlotDialog (cần reason, gọi RPC)
      setDeletingSlot(slot)
      setDeletingSlotMode(mode) // P-6: capture mode lúc mở
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
          isEmergencyOverride: data.isEmergency,
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
    <PageContainer variant='wide' className='flex flex-col gap-4'>
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

        {/* WeekPickerPopover thay thế plain text range (AC1) */}
        <WeekPickerPopover weekOf={currentWeekOf} onWeekChange={setCurrentWeekOf} />

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

      {/* Schedule grid: TimeGrid (desktop) hoặc ScheduleGrid (mobile) */}
      {isLoading ? (
        <ScheduleGridSkeleton />
      ) : isMobile ? (
        // Mobile: list card view unchanged (AC10)
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
                ? deleteSlotDirect.variables?.slotId
                : undefined
          }
        />
      ) : (
        // Desktop: 24h time-grid với drag-to-create (AC3–AC8)
        <TimeGrid
          slots={slots}
          weekOf={currentWeekOf}
          userTimezone={userTimezone}
          onAddSlot={handleAddSlot}
          onEditSlot={handleEditSlot}
          onDeleteSlot={handleDeleteSlot}
          onDragCreate={handleDragCreate}
          isDeletingSlotId={
            deleteSlotWithReason.isPending
              ? deletingSlot?.id
              : deleteSlotDirect.isPending
                ? deleteSlotDirect.variables?.slotId
                : undefined
          }
          className="flex-1 min-h-0"
        />
      )}

      {/* Slot form dialog — Add slot (AC3: defaultDate pre-fill, AC8: drag-to-create defaults) */}
      <SlotForm
        open={slotFormOpen}
        onOpenChange={handleSlotFormOpenChange}
        weekOf={currentWeekOf}
        defaultDate={slotFormDefaultDate}
        defaultStartTime={dragCreateDefaults?.startTime}
        defaultEndTime={dragCreateDefaults?.endTime}
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
          isEmergency={editingSlotMode === 'started'}
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
          isEmergency={deletingSlotMode === 'started'}
          isLoading={deleteSlotWithReason.isPending}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  )
}
