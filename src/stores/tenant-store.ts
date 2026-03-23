import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'
import type { MemberRole } from '@/lib/permissions'

interface TenantMember {
  tenantId: string
  role: MemberRole
}

interface TenantJwtClaims {
  tenant_roles?: Record<string, MemberRole>
  [key: string]: unknown
}

interface TenantState {
  activeTenantId: string | null
  activeRole: MemberRole | null
  tenants: TenantMember[]
  setActiveTenant: (tenantId: string) => void
  initFromSession: (accessToken: string) => void
  reset: () => void
}

export const useTenantStore = create<TenantState>()((set, get) => ({
  activeTenantId: null,
  activeRole: null,
  tenants: [],

  initFromSession: (accessToken: string) => {
    try {
      const claims = jwtDecode<TenantJwtClaims>(accessToken)
      const tenantRoles = claims.tenant_roles ?? {}

      const tenants: TenantMember[] = Object.entries(tenantRoles).map(
        ([tenantId, role]) => ({ tenantId, role })
      )

      // Restore activeTenantId từ localStorage nếu còn hợp lệ
      const stored = localStorage.getItem('active_tenant_id')
      const storedIsValid = stored && tenants.some((t) => t.tenantId === stored)
      const activeTenantId = storedIsValid ? stored : (tenants[0]?.tenantId ?? null)
      const activeRole = tenants.find((t) => t.tenantId === activeTenantId)?.role ?? null

      set({ tenants, activeTenantId, activeRole })
    } catch {
      // Token không hợp lệ hoặc chưa có tenant
      set({ tenants: [], activeTenantId: null, activeRole: null })
    }
  },

  setActiveTenant: (tenantId: string) => {
    const { tenants } = get()
    const found = tenants.find((t) => t.tenantId === tenantId)
    if (!found) return

    localStorage.setItem('active_tenant_id', tenantId)
    set({ activeTenantId: tenantId, activeRole: found.role })
  },

  reset: () => {
    localStorage.removeItem('active_tenant_id')
    set({ activeTenantId: null, activeRole: null, tenants: [] })
  },
}))
