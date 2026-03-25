import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { useTenantStore } from '@/stores/tenant-store'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase-browser'
import { updateActiveTenant, getUserProfile } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ROUTES } from '@/lib/routes'
import { useUnreadCount } from '@/features/notifications/hooks/use-unread-count'
import { useNotificationsRealtime } from '@/features/notifications/hooks/use-notifications-realtime'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { tenants, activeTenantId, activeRole, initFromSession, setActiveTenant } = useTenantStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Notifications: unread count badge + realtime subscription
  // AppSidebar luôn mount → subscription active toàn bộ session
  const { data: unreadCount = 0 } = useUnreadCount(activeTenantId, user?.id ?? null)
  useNotificationsRealtime(activeTenantId, user?.id ?? null)

  // Inject unread badge vào nav item "Notifications" + filter items theo role
  const navGroupsWithBadge = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.roles || (activeRole && item.roles.includes(activeRole)))
        .map((item) =>
          item.url === ROUTES.app.notifications
            ? { ...item, badge: unreadCount > 0 ? String(unreadCount > 99 ? '99+' : unreadCount) : undefined }
            : item
        ),
    }))
    .filter((group) => group.items.length > 0)
  const [isSwitching, setIsSwitching] = useState(false)

  // Query tenant names từ DB dựa trên tenant IDs trong store
  const tenantIds = tenants.map((t) => t.tenantId)
  const { data: tenantRecords } = useQuery({
    queryKey: [QUERY_KEYS.tenantNames, tenantIds],
    queryFn: async () => {
      if (tenantIds.length === 0) return []
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds)
      if (error) throw error
      return data ?? []
    },
    enabled: tenantIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache 5 phút — team names ít thay đổi
  })

  // Query user profile để lấy avatar_url thật (Story 8-10)
  // Dùng cùng queryKey với profile page → invalidate ở 1 chỗ cập nhật cả hai
  const { data: profileData } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // Cache 2 phút
  })

  // Build teams array cho TeamSwitcher
  const teams = tenants.map((t) => ({
    id: t.tenantId,
    name: tenantRecords?.find((r) => r.id === t.tenantId)?.name ?? 'Loading...',
    logo: Building2, // Default icon
    plan: t.role,    // Hiển thị role dưới team name
  }))

  // Build navUser object cho NavUser footer
  const navUser = {
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    avatar: profileData?.avatar_url ?? undefined,  // P-11: undefined thay vì '' để Radix AvatarFallback hoạt động đúng
  }

  const handleSwitch = async (newTenantId: string) => {
    if (!user || newTenantId === activeTenantId) return
    if (!tenants.some((t) => t.tenantId === newTenantId)) return  // [P-4] validate tenant membership
    if (isSwitching) return  // [P-1] re-entry guard

    setIsSwitching(true)
    let dbWritten = false
    try {
      // 1. Lưu active_tenant_id vào DB để hook đọc được
      await updateActiveTenant(user.id, newTenantId)
      dbWritten = true

      // 2. Refresh session để JWT có active_tenant_id mới
      const { data: refreshData, error } = await supabase.auth.refreshSession()
      if (error) throw error
      if (!refreshData.session) throw new Error('Session refresh returned null')

      // 3. Update client stores
      initFromSession(refreshData.session.access_token)
      setActiveTenant(newTenantId)

      // 4. Clear toàn bộ query cache — data cũ thuộc về tenant cũ
      queryClient.clear()

      // 5. Navigate về dashboard để reload data với tenant context mới
      await navigate({ to: ROUTES.app.dashboard })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[AppSidebar] tenant switch failed:', err)
      // [P-2] Rollback DB write nếu refreshSession fail
      if (dbWritten) {
        await updateActiveTenant(user.id, activeTenantId ?? '').catch((rollbackErr) => {
          // eslint-disable-next-line no-console
          console.error('[AppSidebar] rollback failed:', rollbackErr)
        })
      }
      toast.error('Không thể chuyển team. Vui lòng thử lại.')
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Story 1.7: TeamSwitcher thực thay thế AppTitle — disabled khi đang switch */}
        <TeamSwitcher
          teams={teams}
          onSwitch={isSwitching ? undefined : handleSwitch}
          onCreateTeam={() => void navigate({ to: ROUTES.app.createTenant })}
        />
      </SidebarHeader>
      <SidebarContent>
        {navGroupsWithBadge.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
