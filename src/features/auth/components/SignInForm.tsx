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
import { signIn, initTenantAndGetRoute } from '../services/auth.service'
import { signInSchema, type SignInInput } from '../schemas/auth.schema'

export function SignInForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: SignInInput) => {
    setIsPending(true)
    try {
      const { session } = await signIn(data.email, data.password)
      if (!session) throw new Error('Không thể tạo session')

      const redirectTo = initTenantAndGetRoute(session)
      await navigate({ to: redirectTo })
    } catch (err: unknown) {
      const authErr = err as AuthError
      if (authErr?.code === 'invalid_credentials') {
        toast.error('Email hoặc mật khẩu không chính xác')
      } else {
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
                  autoComplete='current-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='w-full' disabled={isPending}>
          {isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </Form>
  )
}
