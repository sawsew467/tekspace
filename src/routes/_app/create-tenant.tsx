import { createFileRoute } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Placeholder cho Story 1.4: Tenant Creation & Team Settings
// Story 1.4 sẽ implement form tạo tenant đầy đủ

export const Route = createFileRoute('/_app/create-tenant')({
  component: CreateTenantPage,
})

function CreateTenantPage() {
  return (
    <div className='flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <Building2 className='text-muted-foreground h-12 w-12' />
          </div>
          <CardTitle>Tạo team của bạn</CardTitle>
          <CardDescription>
            Tính năng này sẽ được implement trong Story 1.4. Bạn cần tạo một team (tenant) trước khi
            tiếp tục sử dụng TekSpace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-center text-sm'>
            🚧 Đang phát triển — Story 1.4: Tenant Creation & Team Settings
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
