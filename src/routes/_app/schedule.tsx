import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/lib/routes'

export const Route = createFileRoute('/_app/schedule')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.app.schedule, replace: true })
  },
  component: () => null,
})
