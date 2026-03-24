import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { TeamSwitcher } from './team-switcher'
import { useTenantStore } from '@/stores/tenant-store'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase-browser'
import { updateActiveTenant } from '@/features/settings/services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ROUTES } from '@/lib/routes'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { tenants, activeTenantId, initFromSession, setActiveTenant } = useTenantStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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

  // Build teams array cho TeamSwitcher
  const teams = tenants.map((t) => ({
    id: t.tenantId,
    name: tenantRecords?.find((r) => r.id === t.tenantId)?.name ?? 'Loading...',
    logo: Building2, // Default icon
    plan: t.role,    // Hiển thị role dưới team name
  }))

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
      console.error('[AppSidebar] tenant switch failed:', err)
      // [P-2] Rollback DB write nếu refreshSession fail
      if (dbWritten) {
        await updateActiveTenant(user.id, activeTenantId ?? '').catch((rollbackErr) => {
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
        <TeamSwitcher teams={teams} onSwitch={isSwitching ? undefined : handleSwitch} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
