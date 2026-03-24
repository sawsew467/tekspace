import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
          <CardDescription>
            Xác nhận mật khẩu hiện tại trước khi đặt mật khẩu mới
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
