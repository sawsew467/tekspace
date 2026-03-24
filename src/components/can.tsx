import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import type { Permission } from '@/lib/permissions'

interface CanProps {
  do: Permission
  children: ReactNode
  fallback?: ReactNode
}

// Explicit map — TypeScript will error at compile time if a Permission is added
// to lib/permissions.ts but the corresponding key is missing from usePermissions()
const PERMISSION_KEY_MAP: Record<Permission, keyof ReturnType<typeof usePermissions>> = {
  manageSchedule:    'canManageSchedule',
  viewTeamSchedule:  'canViewTeamSchedule',
  approveSchedule:   'canApproveSchedule',
  submitDailyReport: 'canSubmitDailyReport',
  viewTeamDashboard: 'canViewTeamDashboard',
  manageMembers:     'canManageMembers',
  promoteMembers:    'canPromoteMembers',
  manageTenant:      'canManageTenant',
  createIncident:    'canCreateIncident',
  viewAnalytics:     'canViewAnalytics',
}

export function Can({ do: permission, children, fallback = null }: CanProps) {
  const permissions = usePermissions()
  const allowed = permissions[PERMISSION_KEY_MAP[permission]] as boolean
  return allowed ? <>{children}</> : <>{fallback}</>
}
