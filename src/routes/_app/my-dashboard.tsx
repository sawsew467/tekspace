import { createFileRoute } from '@tanstack/react-router'
import { SelfDashboard } from '@/features/dashboard/components/SelfDashboard'

export const Route = createFileRoute('/_app/my-dashboard')({
  head: () => ({
    meta: [{ title: 'My Dashboard — TekSpace' }],
  }),
  component: SelfDashboard,
})
