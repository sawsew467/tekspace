import { createFileRoute } from '@tanstack/react-router'
import { TeamDashboard } from '@/features/dashboard/components/TeamDashboard'

export const Route = createFileRoute('/_app/team-schedule')({
  head: () => ({
    meta: [{ title: 'Lịch nhóm — TekSpace' }],
  }),
  component: TeamDashboard,
})
