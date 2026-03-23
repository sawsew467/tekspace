import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'

// Session timeout: dùng Supabase JWT Expiry = 86400s (24h) trên Dashboard
// TODO: implement true 24h-inactive tracking (per-event) in post-MVP

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const {
      data: { session },
      error,
    } = await context.supabase.auth.getSession()

    if (error || !session) {
      throw redirect({ to: ROUTES.signIn })
    }

    // Sync session vào auth-store để components có thể đọc synchronously
    useAuthStore.getState().setSession(session)

    // Khởi tạo tenant context từ JWT claims (không cần DB query thêm)
    useTenantStore.getState().initFromSession(session.access_token)
  },
  component: AppLayout,
})

function AppLayout() {
  // Layout stub — Header + Sidebar + Outlet sẽ implement đầy đủ trong Story 1.4+
  return (
    <div className='flex min-h-svh'>
      {/* Sidebar placeholder */}
      <aside className='bg-sidebar w-64 shrink-0' />
      {/* Main content */}
      <main className='flex-1'>
        <Outlet />
      </main>
    </div>
  )
}
