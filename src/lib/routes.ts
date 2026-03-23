export const ROUTES = {
  signIn: '/sign-in',
  acceptInvite: '/accept-invite',
  app: {
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
