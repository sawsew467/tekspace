import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useTenantStore } from '@/stores/tenant-store'
import { MemberList } from '@/features/tenant/components/MemberList'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'

export const Route = createFileRoute('/_app/team/members')({
  head: () => ({
    meta: [{ title: 'Thành viên — TekSpace' }],
  }),
  component: TeamMembersPage,
})

function TeamMembersPage() {
  const { user } = useAuthStore()
  const { canManageMembers } = usePermissions()
  const { activeTenantId } = useTenantStore()

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
          Thành viên{settings?.name ? ` — ${settings.name}` : ''}
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Quản lý thành viên trong team của bạn
        </p>
      </div>
      <MemberList canManage={canManageMembers} currentUserId={user?.id ?? ''} />
    </div>
  )
}
