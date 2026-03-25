import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { getMembers } from '@/features/tenant/services/tenant.service'
import { useIncidents } from '@/features/incidents/hooks/use-incidents'
import { useAppeals } from '@/features/incidents/hooks/use-appeals'
import { useIncidentAppealsRealtime } from '@/features/incidents/hooks/use-incident-appeals-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { IncidentList } from '@/features/incidents/components/IncidentList'
import { CreateIncidentDialog } from '@/features/incidents/components/CreateIncidentDialog'
import { AppealDialog } from '@/features/incidents/components/AppealDialog'
import { Can } from '@/components/can'
import { Button } from '@/components/ui/button'

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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [appealIncidentId, setAppealIncidentId] = useState<string | null>(null)

  const { canCreateIncident } = usePermissions()

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

  // Incidents list
  const { data: incidents = [], isLoading: isIncidentsLoading } = useIncidents(activeTenantId)

  // Appeals — RLS tự lọc: member chỉ thấy của mình, manager thấy tất cả
  const { data: appeals = [] } = useAppeals(activeTenantId)

  // Realtime: khi member submit appeal → invalidate cache ngay, không cần F5
  useIncidentAppealsRealtime(activeTenantId)

  // Members list — để resolve names trong IncidentList
  const { data: members = [] } = useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
    queryFn: () => getMembers(activeTenantId!),
    staleTime: 60 * 1000,
    enabled: !!activeTenantId,
  })

  return (
    <div className='container max-w-3xl py-6 space-y-4'>
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

      {/* Incident list */}
      <IncidentList
        incidents={incidents}
        isLoading={isIncidentsLoading}
        members={members}
        userTimezone={timezone}
        appeals={appeals}
        canAppeal={!canCreateIncident}
        onAppeal={(incidentId) => setAppealIncidentId(incidentId)}
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
    </div>
  )
}
