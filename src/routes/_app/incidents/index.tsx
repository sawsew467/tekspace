import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fromZonedTime } from 'date-fns-tz'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { getMembers } from '@/features/tenant/services/tenant.service'
import { useInfiniteIncidents } from '@/features/incidents/hooks/use-infinite-incidents'
import { useAppeals } from '@/features/incidents/hooks/use-appeals'
import { useIncidentAppealsRealtime } from '@/features/incidents/hooks/use-incident-appeals-realtime'
import { useResolutions } from '@/features/incidents/hooks/use-resolutions'
import { usePermissions } from '@/hooks/use-permissions'
import { IncidentList } from '@/features/incidents/components/IncidentList'
import { IncidentFilters } from '@/features/incidents/components/IncidentFilters'
import { CreateIncidentDialog } from '@/features/incidents/components/CreateIncidentDialog'
import { AppealDialog } from '@/features/incidents/components/AppealDialog'
import { Can } from '@/components/can'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'

// Validate timezone string để tránh RangeError
function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const Route = createFileRoute('/_app/incidents/')({
  head: () => ({
    meta: [{ title: 'Incidents — TekSpace' }],
  }),
  component: IncidentsPage,
})

function IncidentsPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [appealIncidentId, setAppealIncidentId] = useState<string | null>(null)

  const { canCreateIncident } = usePermissions()

  // Filter state — chỉ active cho manager view
  const [filterMemberId,          setFilterMemberId]          = useState('')
  const [filterCategory,          setFilterCategory]          = useState('')
  const [filterDateFrom,          setFilterDateFrom]          = useState('')
  const [filterDateTo,            setFilterDateTo]            = useState('')
  const [filterAppealStatus,      setFilterAppealStatus]      = useState('')
  const [filterResolutionStatus,  setFilterResolutionStatus]  = useState('')

  // User profile để lấy timezone (pattern từ notifications.tsx)
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Trả về null khi đang load để tránh flash UTC → real timezone
  const timezone = useMemo((): string | null => {
    if (isProfileLoading) return null
    const raw = userProfile?.timezone
    return isValidTimezone(raw) ? raw : 'UTC'
  }, [userProfile?.timezone, isProfileLoading])

  // Incidents list — infinite scroll (20/page)
  const {
    data: incidentsData,
    isLoading: isIncidentsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteIncidents(activeTenantId)

  const allIncidents = useMemo(
    () => incidentsData?.pages.flatMap((p) => p) ?? [],
    [incidentsData?.pages],
  )

  // Appeals — RLS tự lọc: member chỉ thấy của mình, manager thấy tất cả
  const { data: appeals = [] } = useAppeals(activeTenantId)

  // Resolutions — RLS tự lọc: member chỉ thấy của incidents của mình, manager thấy tất cả
  const { data: resolutions = [] } = useResolutions(activeTenantId)

  // Realtime: khi member submit appeal → invalidate cache ngay, không cần F5
  useIncidentAppealsRealtime(activeTenantId)

  // Members list — để resolve names trong IncidentList
  const { data: members = [] } = useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
    queryFn: () => getMembers(activeTenantId!),
    staleTime: 60 * 1000,
    enabled: !!activeTenantId,
  })

  // Client-side filter — chỉ apply cho manager view (member: RLS đã xử lý)
  // Note: filter chạy trên data đã load — cần scroll để load thêm rồi filter
  const filteredIncidents = useMemo(() => {
    if (!canCreateIncident) return allIncidents

    const tz = timezone ?? 'UTC'

    return allIncidents.filter((incident) => {
      if (filterMemberId && incident.member_id !== filterMemberId) return false
      if (filterCategory && incident.category !== filterCategory) return false
      if (filterDateFrom) {
        // fromZonedTime: chuyển "00:00:00 theo tz của user" sang UTC để so sánh đúng
        // P-6: guard invalid date string (e.g. partial input) để tránh NaN comparison
        const fromRaw = new Date(filterDateFrom + 'T00:00:00')
        if (!isNaN(fromRaw.getTime())) {
          const from = fromZonedTime(fromRaw, tz)
          if (new Date(incident.created_at) < from) return false
        }
      }
      if (filterDateTo) {
        const toRaw = new Date(filterDateTo + 'T23:59:59')
        if (!isNaN(toRaw.getTime())) {
          const to = fromZonedTime(toRaw, tz)
          if (new Date(incident.created_at) > to) return false
        }
      }
      if (filterAppealStatus === 'appealed'     && !appeals.some((a) => a.incident_id === incident.id)) return false
      if (filterAppealStatus === 'not_appealed' &&  appeals.some((a) => a.incident_id === incident.id)) return false

      // Resolution status filter
      if (filterResolutionStatus) {
        const res = resolutions.find((r) => r.incident_id === incident.id)
        if (filterResolutionStatus === 'pending'   && res)                                   return false
        if (filterResolutionStatus === 'dismissed' && (!res || res.outcome !== 'dismissed')) return false
        if (filterResolutionStatus === 'upheld'    && (!res || res.outcome !== 'upheld'))    return false
      }

      return true
    })
  }, [allIncidents, appeals, resolutions, filterMemberId, filterCategory, filterDateFrom, filterDateTo, filterAppealStatus, filterResolutionStatus, canCreateIncident, timezone])

  const handleResetFilters = () => {
    setFilterMemberId('')
    setFilterCategory('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterAppealStatus('')
    setFilterResolutionStatus('')
  }

  return (
    <PageContainer className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <ShieldAlert className='h-6 w-6 text-primary' />
          <h1 className='text-xl font-bold'>Incidents</h1>
        </div>

        <Can do='createIncident'>
          <Button
            size='sm'
            variant='destructive'
            onClick={() => setDialogOpen(true)}
          >
            Log Incident
          </Button>
        </Can>
      </div>

      {/* Filter bar — chỉ hiển thị cho manager/owner */}
      {canCreateIncident && (
        <IncidentFilters
          members={members}
          filterMemberId={filterMemberId}
          filterCategory={filterCategory}
          filterDateFrom={filterDateFrom}
          filterDateTo={filterDateTo}
          filterAppealStatus={filterAppealStatus}
          filterResolutionStatus={filterResolutionStatus}
          onFilterMemberChange={setFilterMemberId}
          onFilterCategoryChange={setFilterCategory}
          onFilterDateFromChange={setFilterDateFrom}
          onFilterDateToChange={setFilterDateTo}
          onFilterAppealStatusChange={setFilterAppealStatus}
          onFilterResolutionStatusChange={setFilterResolutionStatus}
          onReset={handleResetFilters}
        />
      )}

      {/* Incident list */}
      <IncidentList
        incidents={filteredIncidents}
        isLoading={isIncidentsLoading}
        members={members}
        userTimezone={timezone}
        appeals={appeals}
        resolutions={resolutions}
        canAppeal={!canCreateIncident}
        onAppeal={(incidentId) => setAppealIncidentId(incidentId)}
        onViewDetail={(incidentId) => navigate({ to: '/incidents/$incidentId', params: { incidentId } })}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />

      {/* Log Incident Dialog — chỉ render khi có permission */}
      <Can do='createIncident'>
        <CreateIncidentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={activeTenantId}
          currentUserId={user?.id}
        />
      </Can>

      {/* Appeal Dialog — chỉ render cho member */}
      {!canCreateIncident && (
        <AppealDialog
          open={!!appealIncidentId}
          onOpenChange={(open) => { if (!open) setAppealIncidentId(null) }}
          incidentId={appealIncidentId ?? ''}
          tenantId={activeTenantId}
          currentUserId={user?.id}
        />
      )}
    </PageContainer>
  )
}
