export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',
  app: {
    createTenant: '/create-tenant',
    dashboard: '/dashboard',
    schedule: '/schedule',
    scheduleManage: '/schedule/manage',
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    settings: {
      profile: '/settings/profile',
      team: '/settings/team',
    },
  },
} as const
