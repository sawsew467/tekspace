import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAcceptInvite } from '@/features/tenant/hooks/use-accept-invite'
import { validateInviteToken, acceptInvite } from '@/features/tenant/services/tenant.service'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

// TanStack Router search params validation
const inviteSearchSchema = z.object({
  token: z.string().min(1),
})

export const Route = createFileRoute('/accept-invite')({
  validateSearch: inviteSearchSchema,
  component: AcceptInvitePage,
})

// Schema đăng ký cho người chưa có tài khoản (AC3)
const inviteRegisterSchema = z
  .object({
    fullName: z.string().min(1, 'Vui lòng nhập họ tên').max(100, 'Tối đa 100 ký tự'),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu tối đa 128 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

type InviteRegisterInput = z.infer<typeof inviteRegisterSchema>

type InviteState =
  | { status: 'loading' }
  | { status: 'expired'; message: string }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      tenantName: string
      tenantId: string
      invitedEmail: string
      isAuthenticated: boolean
    }

function AcceptInvitePage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const acceptMutation = useAcceptInvite()
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' })
  const [isRegisterPending, setIsRegisterPending] = useState(false)

  const registerForm = useForm<InviteRegisterInput>({
    resolver: zodResolver(inviteRegisterSchema),
    defaultValues: { fullName: '', password: '', confirmPassword: '' },
  })

  useEffect(() => {
    async function init() {
      try {
        // P6: dùng getUser() (server-side verify) thay vì getSession() (local cache)
        // Chạy song song để giảm latency
        const [tokenInfo, { data: { user } }] = await Promise.all([
          validateInviteToken(token),
          supabase.auth.getUser(),
        ])

        if (tokenInfo.status !== 'pending' || new Date(tokenInfo.expiresAt) < new Date()) {
          setInviteState({
            status: 'expired',
            message: 'Lời mời đã hết hạn. Vui lòng liên hệ manager để được invite lại.',
          })
        } else {
          setInviteState({
            status: 'ready',
            tenantName: tokenInfo.tenantName,
            tenantId: tokenInfo.tenantId,
            invitedEmail: tokenInfo.email,
            isAuthenticated: !!user,
          })
        }
      } catch {
        setInviteState({
          status: 'expired',
          message: 'Lời mời không hợp lệ. Vui lòng liên hệ manager.',
        })
      }
    }
    init()
  }, [token])

  // Helper dùng chung sau khi accept thành công (cả AC3 và AC4)
  // P9: initFromSession và setActiveTenant là synchronous Zustand mutations.
  // React 18 tự động batch state updates trong async handlers → không có render
  // giữa 2 lần gọi → _app/route.tsx beforeLoad không thể fire giữa chừng.
  async function finalizeAccept(tenantId: string) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshData.session) {
      toast.error('Không thể làm mới phiên đăng nhập.')
      return false
    }
    const tenantStore = useTenantStore.getState()
    tenantStore.initFromSession(refreshData.session.access_token)
    tenantStore.setActiveTenant(tenantId)
    toast.success('Đã tham gia team thành công!')
    return true
  }

  // AC4: User đã đăng nhập — hiển thị nút "Xác nhận tham gia" → redirect /dashboard
  async function handleConfirm() {
    // P8: guard — không fire nếu invite chưa valid
    if (inviteState.status !== 'ready') return

    acceptMutation.mutate(token, {
      onSuccess: async ({ tenantId }) => {
        const ok = await finalizeAccept(tenantId)
        if (ok) {
          // AC4: authenticated user → /dashboard
          await navigate({ to: ROUTES.app.dashboard })
        }
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Không thể chấp nhận lời mời. Vui lòng thử lại.')
      },
    })
  }

  // AC3: User chưa có tài khoản — đăng ký + tự động accept → redirect /settings/profile
  async function handleRegister(formData: InviteRegisterInput) {
    // P8: guard
    if (inviteState.status !== 'ready') return

    setIsRegisterPending(true)
    try {
      // 1. Đăng ký tài khoản với email từ invite (pre-filled, read-only trên UI)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteState.invitedEmail,
        password: formData.password,
        options: { data: { full_name: formData.fullName } },
      })
      if (signUpError) throw signUpError

      if (!signUpData.session) {
        // Email confirmation enabled → không auto sign-in
        toast.info(
          'Vui lòng kiểm tra email để xác nhận tài khoản, sau đó quay lại link invite này.'
        )
        return
      }

      // 2. Accept invite — supabase client đã có session mới, JWT tự gắn vào request
      const result = await acceptInvite(token)

      // 3. Refresh + cập nhật store + navigate
      const ok = await finalizeAccept(result.tenantId)
      if (ok) {
        // AC3: người mới đăng ký → /settings/profile để setup timezone
        await navigate({ to: ROUTES.app.settings.profile })
      }
    } catch (err) {
      toast.error((err as Error).message || 'Đăng ký không thành công. Vui lòng thử lại.')
    } finally {
      setIsRegisterPending(false)
    }
  }

  // ── Loading state ──
  if (inviteState.status === 'loading') {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  // ── Expired / Error state ──
  if (inviteState.status === 'expired' || inviteState.status === 'error') {
    return (
      <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
        <Card className='w-full max-w-sm'>
          <CardHeader className='text-center'>
            <AlertCircle className='mx-auto mb-2 h-10 w-10 text-destructive' />
            <CardTitle>Lời mời không khả dụng</CardTitle>
            <CardDescription>{inviteState.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // ── Ready: AC4 — Authenticated user — "Xác nhận tham gia" ──
  if (inviteState.isAuthenticated) {
    return (
      <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
        <Card className='w-full max-w-sm'>
          <CardHeader className='text-center'>
            <CheckCircle className='mx-auto mb-2 h-10 w-10 text-primary' />
            <CardTitle>Chấp nhận lời mời</CardTitle>
            <CardDescription>
              Bạn được mời tham gia team{' '}
              <strong>{inviteState.tenantName}</strong> trên TekSpace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-center text-sm text-muted-foreground'>
              Sau khi chấp nhận, bạn sẽ có quyền truy cập vào lịch, báo cáo và dashboard của team.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className='w-full'
              onClick={handleConfirm}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận tham gia'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ── Ready: AC3 — Unauthenticated user — Register form ──
  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader className='text-center'>
          <CheckCircle className='mx-auto mb-2 h-10 w-10 text-primary' />
          <CardTitle>Tạo tài khoản để tham gia</CardTitle>
          <CardDescription>
            Bạn được mời tham gia <strong>{inviteState.tenantName}</strong> trên TekSpace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className='space-y-4'>
              {/* Email — pre-filled từ invite, read-only */}
              <div className='space-y-1.5'>
                <label className='text-sm font-medium leading-none'>Email</label>
                <Input value={inviteState.invitedEmail} disabled className='bg-muted' />
              </div>

              <FormField
                control={registerForm.control}
                name='fullName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Họ và tên</FormLabel>
                    <FormControl>
                      <Input placeholder='Nguyễn Văn A' autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu</FormLabel>
                    <FormControl>
                      <Input type='password' placeholder='Tối thiểu 8 ký tự' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Xác nhận mật khẩu</FormLabel>
                    <FormControl>
                      <Input type='password' placeholder='Nhập lại mật khẩu' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type='submit' className='w-full' disabled={isRegisterPending}>
                {isRegisterPending ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  `Tạo tài khoản & tham gia ${inviteState.tenantName}`
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
