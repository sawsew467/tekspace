import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-browser'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSession: (session: Session | null) => void
}

// Giữ reference subscription bên ngoài store để tránh leak khi HMR reload
let _subscription: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'] | null =
  null

// Flag để phân biệt manual sign-out vs server-side revocation (Story 1.7)
// Module-level để accessible từ component listener trong _app/route.tsx
export let isManualSignOut = false

export const useAuthStore = create<AuthState>()((set) => {
  // Unsubscribe subscription cũ trước khi tạo mới (tránh duplicate listeners khi HMR)
  if (_subscription) {
    _subscription.unsubscribe()
    _subscription = null
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
    })
  })

  _subscription = subscription

  return {
    user: null,
    session: null,
    isLoading: true,

    // setSession chỉ dùng nội bộ (ví dụ: sau khi gọi getSession() trong beforeLoad)
    // Không expose ra ngoài để tránh inject arbitrary session
    setSession: (session) =>
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      }),

    signIn: async (email, password) => {
      set({ isLoading: true })
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // session sẽ được set qua onAuthStateChange — không cần set isLoading: false ở đây
        // (onAuthStateChange sẽ fire ngay sau signIn thành công)
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    signOut: async () => {
      // Supabase SDK dispatches SIGNED_OUT synchronously before signOut() resolves,
      // so isManualSignOut is still true when the listener in _app/route.tsx fires.
      // The finally block resets it only after all listeners have already run.
      isManualSignOut = true  // Mark manual sign-out để tránh show "session revoked" toast
      set({ isLoading: true })
      try {
        await supabase.auth.signOut()
        set({ user: null, session: null, isLoading: false })
      } catch (error) {
        // Dù signOut fail, vẫn clear local state để tránh stuck
        set({ user: null, session: null, isLoading: false })
        throw error
      } finally {
        isManualSignOut = false
      }
    },
  }
})
