import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES } from '@/lib/routes'

// Redirect root "/" → "/dashboard" (auth guard trong _app sẽ xử lý tiếp)
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES.app.dashboard })
  },
})
