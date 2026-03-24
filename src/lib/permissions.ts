export type MemberRole = 'owner' | 'manager' | 'member'

export type Permission =
  | 'manageSchedule'
  | 'viewTeamSchedule'
  | 'approveSchedule'
  | 'submitDailyReport'
  | 'viewTeamDashboard'
  | 'manageMembers'   // Owner + Manager: remove member, resend invite, view invite tab
  | 'promoteMembers'  // Owner only: promote to manager, transfer ownership
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
    'promoteMembers',
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
    'manageMembers',  // Manager can remove members + manage invites (AC#1, AC#4, AC#5)
    'createIncident',
    'viewAnalytics',
  ],
  member: ['viewTeamSchedule', 'submitDailyReport', 'viewTeamDashboard', 'viewAnalytics'],
}

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
