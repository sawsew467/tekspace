import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'

// Layout placeholder + auth guard stub
// Story 1.2 sẽ implement sign-in form đầy đủ
// Story 1.7 sẽ implement tenant switcher logic

export const Route = createFileRoute('/_app')({
  // Dùng context.supabase.auth.getSession() thay vì đọc Zustand snapshot
  // vì onAuthStateChange là async — snapshot có thể là null trên cold load
  // dù user có valid session được lưu trong storage
  beforeLoad: async ({ context }) => {
    const {
      data: { session },
      error,
    } = await context.supabase.auth.getSession()

    if (error || !session) {
      throw redirect({ to: '/sign-in' })
    }

    // Sync session vào store để components có thể đọc synchronously
    useAuthStore.getState().setSession(session)
  },
  component: AppLayout,
})

function AppLayout() {
  // Layout stub — Header + Sidebar + Outlet sẽ implement đầy đủ trong Story 1.2+
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
