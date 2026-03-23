import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase-types'
import { queryClient } from '@/lib/query-client'

interface RouterContext {
  queryClient: QueryClient
  supabase: SupabaseClient<Database>
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    return (
      // KHÔNG wrap Suspense ở đây — để từng route tự handle
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster duration={5000} />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition='bottom-left' />
            <TanStackRouterDevtools position='bottom-right' />
          </>
        )}
      </QueryClientProvider>
    )
  },
})
