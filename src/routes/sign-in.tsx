import { createFileRoute, redirect } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { useTenantStore } from '@/stores/tenant-store'
import { SignInForm } from '@/features/auth/components/SignInForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export const Route = createFileRoute('/sign-in')({
  head: () => ({
    meta: [{ title: 'Đăng nhập — TekSpace' }],
  }),
  beforeLoad: async ({ context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession()

    if (session) {
      // Dùng JWT claims — consistent với _app/route.tsx, không cần DB query
      useTenantStore.getState().initFromSession(session.access_token)
      const { tenants } = useTenantStore.getState()
      throw redirect({
        to: tenants.length > 0 ? ROUTES.app.dashboard : ROUTES.app.createTenant,
      })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
          <p className='text-muted-foreground mt-2 text-sm'>Quản lý lịch làm việc remote team</p>
        </div>

        <Card>
          <CardHeader className='pb-4'>
            <CardTitle className='text-xl'>Chào mừng</CardTitle>
            <CardDescription>Đăng nhập hoặc tạo tài khoản mới</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue='sign-in'>
              <TabsList className='grid w-full grid-cols-2 mb-6'>
                <TabsTrigger value='sign-in'>Đăng nhập</TabsTrigger>
                <TabsTrigger value='register'>Tạo tài khoản</TabsTrigger>
              </TabsList>

              <TabsContent value='sign-in'>
                <SignInForm />
              </TabsContent>

              <TabsContent value='register'>
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
