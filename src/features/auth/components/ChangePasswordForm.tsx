import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'
import { verifyAndChangePassword } from '../services/auth.service'
import { changePasswordSchema, type ChangePasswordInput } from '../schemas/auth.schema'
import { useAuthStore } from '@/stores/auth-store'

export function ChangePasswordForm() {
  const [isPending, setIsPending] = useState(false)
  // Ref guard để ngăn concurrent submit khi React chưa kịp re-render disabled button
  const submitLock = useRef(false)

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  })

  const onSubmit = async (data: ChangePasswordInput) => {
    if (submitLock.current) return
    submitLock.current = true

    const email = useAuthStore.getState().user?.email
    if (!email) {
      // Session đã hết hạn hoặc store chưa khởi tạo — user cần đăng nhập lại
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      submitLock.current = false
      return
    }

    setIsPending(true)
    try {
      await verifyAndChangePassword(email, data.currentPassword, data.newPassword)
      toast.success('Đổi mật khẩu thành công')
      form.reset()
    } catch (err: unknown) {
      const typedErr = err as { code?: string }
      if (typedErr?.code === 'INVALID_CURRENT_PASSWORD') {
        form.setError('currentPassword', { message: 'Mật khẩu hiện tại không đúng' })
      } else {
        toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setIsPending(false)
      submitLock.current = false
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='currentPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu hiện tại</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='••••••••'
                  autoComplete='current-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='newPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu mới</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' autoComplete='new-password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirmNewPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Xác nhận mật khẩu mới</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' autoComplete='new-password' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='w-full' disabled={isPending}>
          {isPending ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
        </Button>
      </form>
    </Form>
  )
}
