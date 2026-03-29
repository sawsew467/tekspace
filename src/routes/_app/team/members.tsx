import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useTenantStore } from '@/stores/tenant-store'
import { MemberList } from '@/features/tenant/components/MemberList'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

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
    <PageContainer className='space-y-6'>
      <PageHeader
        title='Thành viên'
        description='Quản lý thành viên trong nhóm của bạn'
      />
      <MemberList
        canManage={canManageMembers}
        currentUserId={user?.id ?? ''}
        defaultCommittedHours={settings?.default_committed_hours}
      />
    </PageContainer>
  )
}
