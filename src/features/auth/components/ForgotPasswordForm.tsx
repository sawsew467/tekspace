import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { requestPasswordReset } from '../services/auth.service'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/auth.schema'
import { ROUTES } from '@/lib/routes'

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsPending(true)
    try {
      await requestPasswordReset(data.email)
    } catch {
      // Không tiết lộ lỗi cụ thể — tránh user enumeration attack
    } finally {
      // Luôn hiển thị success state dù email có tồn tại hay không
      setIsSuccess(true)
      setIsPending(false)
    }
  }

  if (isSuccess) {
    return (
      <div className='space-y-4 text-center'>
        <p className='text-sm text-muted-foreground'>
          Nếu email tồn tại trong hệ thống, bạn sẽ nhận được email đặt lại mật khẩu trong vài
          phút.
        </p>
        <Link to={ROUTES.signIn} className='text-sm font-medium underline-offset-4 hover:underline'>
          Quay lại đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  placeholder='ban@example.com'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='w-full' disabled={isPending}>
          {isPending ? 'Đang gửi...' : 'Gửi email đặt lại mật khẩu'}
        </Button>

        <div className='text-center'>
          <Link
            to={ROUTES.signIn}
            className='text-sm text-muted-foreground underline-offset-4 hover:underline'
          >
            Quay lại đăng nhập
          </Link>
        </div>
      </form>
    </Form>
  )
}
