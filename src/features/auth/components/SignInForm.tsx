import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from '@tanstack/react-router'
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
import { isInternalUrl } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { Route } from '@/routes/sign-in'

// Routes không được dùng làm redirect target sau login (tránh loop)
const AUTH_PATHS = new Set<string>([
  ROUTES.signIn,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.acceptInvite,
])

/** Kiểm tra URL hợp lệ để redirect-back: internal + không phải auth route */
function isValidRedirectPath(url: string | undefined): url is string {
  if (!isInternalUrl(url)) return false
  const pathname = url.split('?')[0]
  return !AUTH_PATHS.has(pathname)
}

export function SignInForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  // FIX 8-18: đọc redirect param (typed từ validateSearch trong sign-in route)
  const { redirect: redirectParam } = Route.useSearch()

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: SignInInput) => {
    setIsPending(true)
    try {
      const { session } = await signIn(data.email, data.password)
      if (!session) throw new Error('Không thể tạo session')

      const defaultRoute = initTenantAndGetRoute(session)

      // Navigate về URL cũ nếu redirect param hợp lệ (internal + không phải auth route)
      // isValidRedirectPath() chống: external URL, double-slash, loop về sign-in
      if (isValidRedirectPath(redirectParam)) {
        // Tách path và search string để TanStack Router xử lý đúng
        const qIdx = redirectParam.indexOf('?')
        if (qIdx >= 0) {
          const to = redirectParam.slice(0, qIdx)
          const search = Object.fromEntries(new URLSearchParams(redirectParam.slice(qIdx + 1)))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await navigate({ to, search } as any)
        } else {
          await navigate({ to: redirectParam })
        }
      } else {
        await navigate({ to: defaultRoute })
      }
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
              <div className='flex items-center justify-between'>
                <FormLabel>Mật khẩu</FormLabel>
                <Link
                  to={ROUTES.forgotPassword}
                  className='text-xs text-muted-foreground underline-offset-4 hover:underline'
                >
                  Quên mật khẩu?
                </Link>
              </div>
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
