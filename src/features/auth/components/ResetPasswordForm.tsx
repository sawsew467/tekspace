import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
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
import { updatePassword } from '../services/auth.service'
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/auth.schema'
import { ROUTES } from '@/lib/routes'

export function ResetPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsPending(true)
    try {
      await updatePassword(data.password)
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.')
      await navigate({ to: ROUTES.signIn })
    } catch {
      toast.error('Đã có lỗi xảy ra. Vui lòng yêu cầu reset password lại.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='password'
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
          name='confirmPassword'
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
          {isPending ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
        </Button>
      </form>
    </Form>
  )
}
