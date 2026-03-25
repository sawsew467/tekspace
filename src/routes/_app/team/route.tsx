import { createFileRoute, Outlet } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'

export const Route = createFileRoute('/_app/team')({
  component: TeamLayout,
})

function TeamLayout() {
  return (
    <PageContainer variant='wide'>
      <Outlet />
    </PageContainer>
  )
}
