import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
          <p className='text-muted-foreground mt-2 text-sm'>Quản lý lịch làm việc remote team</p>
        </div>

        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-xl'>Quên mật khẩu</CardTitle>
            <CardDescription>
              Nhập email của bạn để nhận link đặt lại mật khẩu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
