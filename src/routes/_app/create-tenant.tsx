import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
import { createTenantSchema, type CreateTenantInput } from '@/features/tenant/schemas/tenant.schema'
import { createTenant } from '@/features/tenant/services/tenant.service'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/_app/create-tenant')({
  component: CreateTenantPage,
})

function CreateTenantPage() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  const form = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: '' },
  })

  const onSubmit = async (data: CreateTenantInput) => {
    // P-11: guard double-submit
    if (isPending) return

    setIsPending(true)
    try {
      // F2: Snapshot tenant IDs TRƯỚC khi insert để identify tenant mới sau refresh
      // Tránh giả định tenants[0] (sai nếu user đã có tenant khác từ trước)
      const existingTenantIds = new Set(
        useTenantStore.getState().tenants.map((t) => t.tenantId)
      )

      // createTenant không trả về tenant.id (bỏ .select() trên INSERT để tránh RLS)
      // Tenant ID được lấy từ JWT sau refreshSession (custom_access_token_hook embeds tenant_roles)
      const { session } = await createTenant(data.name)

      const tenantStore = useTenantStore.getState()
      tenantStore.initFromSession(session.access_token)

      // F2: Tìm tenant mới = tenant xuất hiện trong JWT sau refresh nhưng chưa có trước đó
      // Cách này đúng bất kể user có bao nhiêu tenant trước đó
      const { tenants } = useTenantStore.getState()
      const newTenant = tenants.find((t) => !existingTenantIds.has(t.tenantId))
      if (!newTenant) {
        throw new Error('New tenant not found in session — JWT may not have updated tenant_roles yet')
      }
      tenantStore.setActiveTenant(newTenant.tenantId)

      await navigate({ to: ROUTES.app.settings.team })
    } catch (err) {
      // F3: Log lỗi để debug thay vì silent swallow
      // eslint-disable-next-line no-console
      console.error('[CreateTenantPage] onSubmit error:', err)
      toast.error('Không thể tạo team. Vui lòng thử lại.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className='flex min-h-svh items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mb-4 flex justify-center'>
            <Building2 className='text-muted-foreground h-12 w-12' />
          </div>
          <CardTitle>Tạo team của bạn</CardTitle>
          <CardDescription>
            Đặt tên cho workspace của team bạn để bắt đầu sử dụng TekSpace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên team</FormLabel>
                    <FormControl>
                      <Input placeholder='VD: Acme Corp, My Startup...' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' className='w-full' disabled={isPending}>
                {isPending ? 'Đang tạo...' : 'Tạo team'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
