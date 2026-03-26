export const QUERY_KEYS = {
  scheduleSlots: 'schedule-slots',
  scheduleWeeks: 'schedule-weeks',
  tenantMembers: 'tenant-members',
  tenantInvites: 'tenant-invites',
  tenantSettings: 'tenant-settings',
  dailyReports: 'daily-reports',
  notifications: 'notifications',
  incidents: 'incidents',
  incidentAppeals: 'incident-appeals',
  analytics: 'analytics',
  userProfile: 'user-profile',    // Story 1.7: user profile (timezone, avatar, etc.)
  tenantNames: 'tenant-names',    // Story 1.7: tenant display names for TeamSwitcher
  teamSchedule: 'team-schedule',  // Story 3.1: team overview dashboard
  selfWeekHours: 'self-week-hours',        // Story 3.3: member's own hours this week
  teamAvgCommitment: 'team-avg-commitment', // Story 3.3: anonymous team average commitment rate
  selfStreak: 'self-streak',               // Story 8.12: consecutive report days streak
  incidentOutcomeNotes: 'incident-outcome-notes', // incident outcome notes
  incidentResolutions: 'incident-resolutions',    // Story 9.3: incident lifecycle resolutions
} as const
