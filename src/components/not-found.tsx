import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { useAuthStore } from '@/stores/auth-store'

export function NotFoundPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
      <h1 className='text-2xl font-semibold'>Trang không tồn tại</h1>
      <p className='text-muted-foreground text-sm'>URL này không tồn tại hoặc đã bị xóa</p>
      <div className='flex gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>
          Quay lại
        </Button>
        {session ? (
          <Button onClick={() => navigate({ to: ROUTES.app.dashboard }).catch(console.error)}>
            Về Trang chủ
          </Button>
        ) : (
          <Button onClick={() => navigate({ to: ROUTES.signIn }).catch(console.error)}>
            Đăng nhập
          </Button>
        )}
      </div>
    </div>
  )
}
