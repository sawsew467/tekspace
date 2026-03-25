import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { hasPermission } from '@/lib/permissions'
import { ROUTES } from '@/lib/routes'
import { InviteListSection } from '@/features/tenant/components/InviteListSection'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'

export const Route = createFileRoute('/_app/team/invites')({
  beforeLoad: () => {
    const { activeRole } = useTenantStore.getState()
    if (!activeRole || !hasPermission(activeRole, 'manageMembers')) {
      throw redirect({ to: ROUTES.app.dashboard })
    }
  },
  head: () => ({
    meta: [{ title: 'Lời mời — TekSpace' }],
  }),
  component: TeamInvitesPage,
})

function TeamInvitesPage() {
  const { activeTenantId, activeRole } = useTenantStore()

  const { data: settings } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => getTenantSettings(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>
          Lời mời{settings?.name ? ` — ${settings.name}` : ''}
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Quản lý lời mời thành viên cho team
        </p>
      </div>
      <InviteListSection canManage={hasPermission(activeRole ?? 'member', 'manageMembers')} />
    </div>
  )
}
