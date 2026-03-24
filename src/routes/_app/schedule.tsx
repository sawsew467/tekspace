import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfISOWeek, format, parseISO, addDays } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase-browser'
import { useScheduleWeek } from '@/features/schedule/hooks/use-schedule-week'
import { useScheduleSlots } from '@/features/schedule/hooks/use-schedule-slots'
import { useUpsertSlots } from '@/features/schedule/hooks/use-upsert-slots'
import { usePreviousWeekSlots } from '@/features/schedule/hooks/use-previous-week-slots'
import { ScheduleGrid, ScheduleGridSkeleton } from '@/features/schedule/components/ScheduleGrid'
import { ScheduleDeadlineBadge } from '@/features/schedule/components/ScheduleDeadlineBadge'
import { SlotForm } from '@/features/schedule/components/SlotForm'
import {
  ScheduleService,
  convertSlotToUTC,
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
  const queryClient = useQueryClient()

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

  const [slotFormOpen, setSlotFormOpen] = useState(false)
  const [deletingSlotId, setDeletingSlotId] = useState<string | undefined>()

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

  // Upsert mutation (atomic via RPC)
  const upsertSlots = useUpsertSlots()
  const { mutate: upsertMutate, isPending: isUpsertPending } = upsertSlots

  // Delete single slot mutation — với tenant_id + user_id filter (P11: tenant isolation)
  const deleteSlot = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('schedule_slots')
        .delete()
        .eq('id', slotId)
        .eq('tenant_id', activeTenantId!)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onMutate: (slotId) => setDeletingSlotId(slotId),
    onSettled: () => setDeletingSlotId(undefined),
    onSuccess: () => {
      toast.success('Đã xóa ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, scheduleWeek?.id] })
    },
    onError: (error: Error) => {
      toast.error('Không thể xóa ca: ' + error.message)
    },
  })

  const userTimezone = userProfile?.timezone ?? 'UTC'

  // isLoading bao gồm isPreviousSlotsLoading để banner không nhấp nháy khi data còn loading
  const isLoading = isProfileLoading || isTenantLoading || isWeekLoading || isSlotsLoading || isPreviousSlotsLoading

  // Banner template: hiện khi tuần đang xem trống và tuần trước có data.
  // User chủ động quyết định có tải template hay không (không auto-apply).
  const showTemplateBanner =
    !isLoading &&
    !!scheduleWeek &&
    !scheduleWeek.is_locked &&
    slots.length === 0 &&
    previousSlots.length > 0

  function handleApplyTemplate() {
    if (!scheduleWeek || isUpsertPending) return
    const shiftedSlots = shiftSlotsToCurrentWeek(previousSlots, tenantTimezone)
    upsertMutate(
      { weekId: scheduleWeek.id, slots: shiftedSlots },
      { onSuccess: () => toast.success('Đã tải lịch từ tuần trước làm template') }
    )
  }

  function handleAddSlot(_date: string) {
    setSlotFormOpen(true)
  }

  // Thêm slot mới vào list hiện tại rồi upsert tất cả (atomic)
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
          onDeleteSlot={(slotId) => deleteSlot.mutate(slotId)}
          isDeletingSlotId={deletingSlotId}
        />
      )}

      {/* Slot form dialog */}
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
    </div>
  )
}
