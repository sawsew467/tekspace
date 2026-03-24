import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className='container mx-auto max-w-3xl py-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold'>Cài đặt</h1>
        <p className='text-muted-foreground mt-1 text-sm'>Quản lý tài khoản và cài đặt nhóm</p>
      </div>

      <div className='flex gap-6'>
        {/* Sidebar navigation */}
        <nav className='w-48 shrink-0'>
          <ul className='space-y-1'>
            <li>
              <Link
                to={ROUTES.app.settings.profile}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === ROUTES.app.settings.profile
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Tài khoản
              </Link>
            </li>
            <li>
              <Link
                to={ROUTES.app.settings.team}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === ROUTES.app.settings.team
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Nhóm
              </Link>
            </li>
          </ul>
        </nav>

        {/* Content */}
        <div className='flex-1'>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
