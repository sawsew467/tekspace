import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { toast } from 'sonner'
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
  head: () => ({
    meta: [{ title: 'Tạo team — TekSpace' }],
  }),
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
      const existingTenantIds = new Set(
        useTenantStore.getState().tenants.map((t) => t.tenantId)
      )

      const { session } = await createTenant(data.name)

      const tenantStore = useTenantStore.getState()
      tenantStore.initFromSession(session.access_token)

      const { tenants } = useTenantStore.getState()
      const newTenant = tenants.find((t) => !existingTenantIds.has(t.tenantId))
      if (!newTenant) {
        throw new Error('New tenant not found in session — JWT may not have updated tenant_roles yet')
      }
      tenantStore.setActiveTenant(newTenant.tenantId)

      await navigate({ to: ROUTES.app.team.members })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CreateTenantPage] onSubmit error:', err)
      toast.error('Không thể tạo team. Vui lòng thử lại.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
      <div className='w-full max-w-sm'>
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
          <p className='text-muted-foreground mt-2 text-sm'>Tạo workspace cho team của bạn</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Tạo team</CardTitle>
            <CardDescription>Đặt tên cho team workspace của bạn</CardDescription>
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
    </div>
  )
}

