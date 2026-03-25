import { createFileRoute, Outlet } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'

export const Route = createFileRoute('/_app/account')({
  component: AccountLayout,
})

function AccountLayout() {
  return (
    <PageContainer>
      <Outlet />
    </PageContainer>
  )
}
