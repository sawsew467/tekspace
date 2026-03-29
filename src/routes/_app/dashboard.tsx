import { createFileRoute } from '@tanstack/react-router'
import { SelfDashboard } from '@/features/dashboard/components/SelfDashboard'

export const Route = createFileRoute('/_app/dashboard')({
  head: () => ({
    meta: [{ title: 'Trang chủ — TekSpace' }],
  }),
  component: SelfDashboard,
})
