import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { useAuthStore } from '@/stores/auth-store'
import { isSoleOwner } from '@/features/tenant/services/tenant.service'

export const Route = createFileRoute('/_app/settings/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = useAuthStore()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [soleOwnerBlocked, setSoleOwnerBlocked] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  const handleDeleteAccountClick = async () => {
    if (!user?.id) return
    setIsChecking(true)
    setSoleOwnerBlocked(false)
    try {
      const sole = await isSoleOwner(user.id)
      if (sole) {
        setSoleOwnerBlocked(true)
      } else {
        setDeleteConfirmOpen(true)
      }
    } catch {
      // P7: query failed — show error, do NOT silently open delete dialog
      toast.error('Không thể kiểm tra trạng thái owner. Vui lòng thử lại.')
    } finally {
      setIsChecking(false)
    }
  }

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

      {/* Xóa tài khoản */}
      <Card className='border-destructive/50'>
        <CardHeader>
          <CardTitle className='text-destructive'>Xóa tài khoản</CardTitle>
          <CardDescription>
            Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {soleOwnerBlocked && (
            <Alert variant='destructive'>
              <AlertTriangle className='h-4 w-4' />
              <AlertDescription>
                Bạn cần transfer ownership hoặc xóa tenant trước khi xóa tài khoản.
              </AlertDescription>
            </Alert>
          )}
          <Button
            variant='destructive'
            onClick={handleDeleteAccountClick}
            disabled={isChecking}
          >
            {isChecking ? 'Đang kiểm tra...' : 'Xóa tài khoản'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirm dialog — stub, không gọi API thật (post-MVP) */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title='Xóa tài khoản'
        desc='Tính năng xóa tài khoản sẽ khả dụng sau khi ra mắt. Vui lòng liên hệ support nếu cần hỗ trợ.'
        confirmText='Đã hiểu'
        cancelBtnText='Hủy'
        handleConfirm={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
