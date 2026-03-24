import { useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore, isManualSignOut } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { supabase } from '@/lib/supabase-browser'
import { ROUTES } from '@/lib/routes'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

// Session timeout: dùng Supabase JWT Expiry = 86400s (24h) trên Dashboard
// TODO: implement true 24h-inactive tracking (per-event) in post-MVP

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
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

    // Redirect đến create-tenant nếu user chưa có tenant
    // P11: dùng exact match (+ trailing slash) thay vì startsWith để tránh
    //      path prefix collision (vd: /create-tenant-something bypass redirect)
    const { activeTenantId } = useTenantStore.getState()
    const p = location.pathname
    const isOnCreateTenant =
      p === ROUTES.app.createTenant || p === ROUTES.app.createTenant + '/'
    if (!activeTenantId && !isOnCreateTenant) {
      throw redirect({ to: ROUTES.app.createTenant })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const navigate = useNavigate()

  // Story 1.7: Detect server-side session invalidation real-time
  // Khi user bị remove khỏi tenant (Story 1.6), admin.signOut() được gọi server-side
  // → SIGNED_OUT event fire → redirect to sign-in với toast thông báo
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !isManualSignOut) {
        // Server-side revocation — không phải user tự sign out
        toast.error('Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.')
        void navigate({ to: ROUTES.signIn })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return <AuthenticatedLayout />
}
