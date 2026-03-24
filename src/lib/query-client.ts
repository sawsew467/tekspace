import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ROUTES } from './routes'

const isSessionError = (error: unknown): boolean => {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  const status = (error as { status?: number }).status
  const code = (error as { code?: string }).code
  return (
    status === 401 ||
    code === 'PGRST301' ||
    msg.includes('JWT expired') ||
    msg.includes('not authenticated') ||
    msg.includes('session_not_found') ||
    msg.includes('User not found') ||
    msg.includes('Session not found')
  )
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      if (isSessionError(error)) {
        toast.error('Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.')
        // Small delay để user thấy toast trước khi redirect
        setTimeout(() => {
          window.location.href = ROUTES.signIn
        }, 1500)
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
