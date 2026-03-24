import { useTenantStore } from '@/stores/tenant-store'
import { hasPermission, type Permission } from '@/lib/permissions'

export function usePermissions() {
  const { activeRole } = useTenantStore()

  const can = (permission: Permission): boolean => {
    if (!activeRole) return false
    return hasPermission(activeRole, permission)
  }

  return {
    canManageSchedule:    can('manageSchedule'),
    canViewTeamSchedule:  can('viewTeamSchedule'),
    canApproveSchedule:   can('approveSchedule'),
    canSubmitDailyReport: can('submitDailyReport'),
    canViewTeamDashboard: can('viewTeamDashboard'),
    canManageMembers:     can('manageMembers'),     // Owner + Manager: remove, resend invite, invite tab
    canPromoteMembers:    can('promoteMembers'),    // Owner only: promote to manager, transfer ownership
    canManageTenant:      can('manageTenant'),      // Owner only
    canCreateIncident:    can('createIncident'),    // Manager + Owner
    canViewAnalytics:     can('viewAnalytics'),     // All roles
    activeRole,           // Expose raw role khi cần
  }
}
