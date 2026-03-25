import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
      <h1 className='text-2xl font-semibold'>Trang không tồn tại</h1>
      <p className='text-muted-foreground text-sm'>URL này không tồn tại hoặc đã bị xóa</p>
      <div className='flex gap-2'>
        <Button variant='outline' onClick={() => window.history.back()}>
          Quay lại
        </Button>
        <Button onClick={() => navigate({ to: ROUTES.app.dashboard }).catch(console.error)}>
          Về Dashboard
        </Button>
      </div>
    </div>
  )
}
