import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/lib/routes'

export const Route = createFileRoute('/_app/my-dashboard')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.app.dashboard, replace: true })
  },
  component: () => null,
})
