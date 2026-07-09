export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',
  app: {
    createTenant: '/create-tenant',
    teamSchedule: '/team-schedule',       // Team Schedule (overview of all members)
    dashboard: '/dashboard',               // Personal Dashboard (SelfDashboard)
    schedule: '/my-schedule',              // My Schedule registration
    scheduleManage: '/my-schedule/manage', // Schedule manage
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    account: {
      profile: '/account/profile',
      security: '/account/security',
      tokens: '/account/tokens',
    },
    usage: '/usage',
    team: {
      members: '/team/members',
      invites: '/team/invites',
      settings: '/team/settings',
    },
    admin: {
      import: '/admin/import',
    },
  },
} as const
