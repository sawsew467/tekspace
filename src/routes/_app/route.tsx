import { useEffect } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
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
    // getUser() verify với server thay vì chỉ đọc cache local
    // getSession() chỉ đọc localStorage → không detect token revocation server-side
    // getUser() gọi GET /auth/v1/user → server verify → detect revocation ngay lập tức
    const {
      data: { user },
      error: userError,
    } = await context.supabase.auth.getUser()

    if (userError) {
      // Chỉ redirect khi xác định là auth failure:
      //   - HTTP 401: token revoked server-side
      //   - AuthSessionMissingError: không có session trong storage (chưa login / đã logout)
      // Network error / server error (status 0 hoặc 5xx) → throw để error boundary xử lý,
      // tránh hiện tượng mạng chập chờn silently đẩy user đang login ra sign-in
      const isNoSession = userError.name === 'AuthSessionMissingError'
      if (userError.status === 401 || isNoSession) {
        throw redirect({
          to: ROUTES.signIn,
          search: { redirect: location.pathname + location.search },
        })
      }
      throw userError
    }

    if (!user) {
      throw redirect({
        to: ROUTES.signIn,
        search: { redirect: location.pathname + location.search },
      })
    }

    // Vẫn cần getSession() để lấy access_token cho JWT claims
    // (getUser() không trả về session/access_token)
    const {
      data: { session },
    } = await context.supabase.auth.getSession()

    if (!session) {
      throw redirect({
        to: ROUTES.signIn,
        search: { redirect: location.pathname + location.search },
      })
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // FIX 1: create-tenant là onboarding fullscreen, không có sidebar
  const isOnboarding = pathname === ROUTES.app.createTenant

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

  // Onboarding: fullscreen, không sidebar
  if (isOnboarding) return <Outlet />

  return <AuthenticatedLayout />
}

