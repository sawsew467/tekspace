import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ROUTES } from './routes'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      const err = error as { status?: number; code?: string }
      if (err?.status === 401 || err?.code === 'PGRST301') {
        window.location.href = ROUTES.signIn
        return
      }
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
