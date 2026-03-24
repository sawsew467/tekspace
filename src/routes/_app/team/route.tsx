import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/team')({
  component: TeamLayout,
})

function TeamLayout() {
  return (
    <div className='container mx-auto max-w-4xl py-8'>
      <Outlet />
    </div>
  )
}
