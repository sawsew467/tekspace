import { createFileRoute, Outlet } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'

export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <PageContainer variant='wide'>
      <Outlet />
    </PageContainer>
  )
}
