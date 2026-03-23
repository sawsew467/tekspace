import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'
import { ROUTES } from '@/lib/routes'

export const Route = createFileRoute('/reset-password')({
  // Chỉ parse `error` param từ Supabase redirect lỗi (e.g. ?error=access_denied)
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search['error'] === 'string' ? search['error'] : '',
  }),
  // Kiểm tra recovery session tồn tại sau khi Supabase xử lý URL token/code.
  // Xử lý cả PKCE (?code=xxx) và implicit flow (#access_token=xxx) vì supabase-js
  // tự exchange token khi khởi tạo singleton, trước khi loader này chạy.
  // Nếu không có session (link hết hạn, đã dùng, hoặc truy cập trực tiếp) → hasSession=false.
  loader: async ({ context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession()
    return { hasSession: !!session }
  },
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { error } = Route.useSearch()
  const { hasSession } = Route.useLoaderData()

  // Hiển thị expired UI khi: Supabase trả về ?error param HOẶC không có recovery session
  if (error || !hasSession) {
    return (
      <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
        <div className='w-full max-w-sm'>
          <div className='mb-8 text-center'>
            <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              Quản lý lịch làm việc remote team
            </p>
          </div>

          <Card>
            <CardHeader className='pb-4'>
              <CardTitle className='text-xl'>Link đã hết hạn</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Link đã hết hạn. Vui lòng yêu cầu reset password lại.
              </p>
              <Link
                to={ROUTES.forgotPassword}
                className='text-sm font-medium underline-offset-4 hover:underline'
              >
                Yêu cầu lại
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
          <p className='text-muted-foreground mt-2 text-sm'>Quản lý lịch làm việc remote team</p>
        </div>

        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-xl'>Đặt lại mật khẩu</CardTitle>
            <CardDescription>Nhập mật khẩu mới cho tài khoản của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
