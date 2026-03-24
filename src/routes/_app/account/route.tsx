import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account')({
  component: AccountLayout,
})

function AccountLayout() {
  return (
    <div className='container mx-auto max-w-2xl py-8'>
      <Outlet />
    </div>
  )
}
