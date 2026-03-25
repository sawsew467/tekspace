export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',
  app: {
    createTenant: '/create-tenant',
    dashboard: '/dashboard',
    myDashboard: '/my-dashboard',
    schedule: '/schedule',
    scheduleManage: '/schedule/manage',
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    account: {
      profile: '/account/profile',
      security: '/account/security',
    },
    team: {
      members: '/team/members',
      invites: '/team/invites',
      settings: '/team/settings',
    },
  },
} as const
