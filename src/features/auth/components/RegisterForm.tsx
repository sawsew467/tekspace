import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { AuthError } from '@supabase/supabase-js'

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
import { signUp, initTenantAndGetRoute } from '../services/auth.service'
import { registerSchema, type RegisterInput } from '../schemas/auth.schema'

export function RegisterForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: RegisterInput) => {
    setIsPending(true)
    try {
      const { session } = await signUp(data.email, data.password, data.fullName)
      if (!session) throw new Error('Không thể tạo session')

      const redirectTo = initTenantAndGetRoute(session)
      await navigate({ to: redirectTo })
    } catch (err: unknown) {
      const authErr = err as AuthError
      if (authErr?.code === 'invalid_credentials') {
        toast.error('Email hoặc mật khẩu không chính xác')
      } else {
        // Không phân biệt loại lỗi auth (tránh user enumeration) — AC5
        toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='fullName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ và tên</FormLabel>
              <FormControl>
                <Input
                  type='text'
                  placeholder='Nguyễn Văn A'
                  autoComplete='name'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder='••••••••'
                  autoComplete='new-password'
                  {...field}
                />
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
              <FormLabel>Xác nhận mật khẩu</FormLabel>
              <FormControl>
                <Input
                  type='password'
                  placeholder='••••••••'
                  autoComplete='new-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='w-full' disabled={isPending}>
          {isPending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </Button>
      </form>
    </Form>
  )
}
