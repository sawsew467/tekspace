import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startOfISOWeek, format, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
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
import { ScheduleGrid, ScheduleGridSkeleton } from '@/features/schedule/components/ScheduleGrid'
import { ScheduleDeadlineBadge } from '@/features/schedule/components/ScheduleDeadlineBadge'
import { SlotForm } from '@/features/schedule/components/SlotForm'
import {
  ScheduleService,
  convertSlotToUTC,
} from '@/features/schedule/services/schedule.service'
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

  // Reactive currentWeekOf — re-check khi window gets focus (P6: fix module-level stale constant)
  const [currentWeekOf, setCurrentWeekOf] = useState(getCurrentWeekOf)
  useEffect(() => {
    const checkWeekChange = () => {
      const newWeek = getCurrentWeekOf()
      setCurrentWeekOf((prev) => (prev !== newWeek ? newWeek : prev))
    }
    window.addEventListener('focus', checkWeekChange)
    return () => window.removeEventListener('focus', checkWeekChange)
  }, [])

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

  // Upsert mutation (atomic via RPC)
  const upsertSlots = useUpsertSlots()

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
  const isLoading = isProfileLoading || isTenantLoading || isWeekLoading || isSlotsLoading

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
      { onSuccess: () => setSlotFormOpen(false) }
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Lịch làm việc</h1>
            <p className="text-sm text-muted-foreground">
              Tuần từ {format(parseISO(currentWeekOf), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Deadline badge */}
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
