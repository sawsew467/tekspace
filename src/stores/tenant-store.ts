import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'
import type { MemberRole } from '@/lib/permissions'

interface TenantMember {
  tenantId: string
  role: MemberRole
}

interface TenantJwtClaims {
  tenant_roles?: Record<string, MemberRole>
  active_tenant_id?: string  // set bởi custom_access_token_hook — source of truth cho RLS
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

      // JWT's active_tenant_id là source of truth cho RLS:
      // current_tenant_id() trong Postgres đọc từ JWT — KHÔNG phải localStorage.
      // Nếu store dùng localStorage (khác JWT), INSERT sẽ fail 42501 dù tenant đúng.
      const jwtTenantId = claims.active_tenant_id ?? null
      const jwtTenantValid = jwtTenantId && tenants.some((t) => t.tenantId === jwtTenantId)

      let activeTenantId: string | null
      if (jwtTenantValid) {
        // JWT hợp lệ → dùng JWT (đảm bảo đồng bộ với RLS)
        activeTenantId = jwtTenantId
      } else {
        // JWT không có / tenant bị xóa → fallback localStorage rồi tenants[0]
        const stored = localStorage.getItem('active_tenant_id')
        const storedIsValid = stored && tenants.some((t) => t.tenantId === stored)
        activeTenantId = storedIsValid ? stored : (tenants[0]?.tenantId ?? null)
      }

      const activeRole = tenants.find((t) => t.tenantId === activeTenantId)?.role ?? null

      // Sync localStorage với giá trị thực tế đang dùng
      if (activeTenantId) localStorage.setItem('active_tenant_id', activeTenantId)

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
