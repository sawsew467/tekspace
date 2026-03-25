import { useEffect } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { useAuthStore } from '@/stores/auth-store'

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error)
    }
  }, [error])

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
      <h1 className='text-2xl font-semibold'>Có lỗi xảy ra</h1>
      <p className='text-muted-foreground text-sm'>Vui lòng thử lại hoặc quay lại trang trước</p>
      <div className='flex gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>
          Quay lại
        </Button>
        {session ? (
          <>
            <Button variant='outline' onClick={() => reset?.()}>
              Thử lại
            </Button>
            <Button onClick={() => navigate({ to: ROUTES.app.dashboard }).catch(console.error)}>
              Về Dashboard
            </Button>
          </>
        ) : (
          <Button onClick={() => navigate({ to: ROUTES.signIn }).catch(console.error)}>
            Đăng nhập
          </Button>
        )}
      </div>
    </div>
  )
}
