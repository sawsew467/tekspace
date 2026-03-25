import { useEffect } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function ErrorPage({ error }: ErrorComponentProps) {
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
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
      </div>
    </div>
  )
}
