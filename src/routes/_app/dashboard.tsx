import { createFileRoute } from '@tanstack/react-router'
import { TeamDashboard } from '@/features/dashboard/components/TeamDashboard'

export const Route = createFileRoute('/_app/dashboard')({
  head: () => ({
    meta: [{ title: 'Team Dashboard — TekSpace' }],
  }),
  component: TeamDashboard,
})
