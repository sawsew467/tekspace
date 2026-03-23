export type MemberRole = 'owner' | 'manager' | 'member'

export type Permission =
  | 'manageSchedule'
  | 'viewTeamSchedule'
  | 'approveSchedule'
  | 'submitDailyReport'
  | 'viewTeamDashboard'
  | 'manageMembers'
  | 'manageTenant'
  | 'createIncident'
  | 'viewAnalytics'

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    'manageSchedule',
    'viewTeamSchedule',
    'approveSchedule',
    'submitDailyReport',
    'viewTeamDashboard',
    'manageMembers',
    'manageTenant',
    'createIncident',
    'viewAnalytics',
  ],
  manager: [
    'manageSchedule',
    'viewTeamSchedule',
    'approveSchedule',
    'submitDailyReport',
    'viewTeamDashboard',
    'createIncident',
    'viewAnalytics',
  ],
  member: ['viewTeamSchedule', 'submitDailyReport', 'viewTeamDashboard', 'viewAnalytics'],
}

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
