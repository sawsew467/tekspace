import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Placeholder cho Story 3.1: Team Overview Dashboard
// Story 3.1 sẽ implement team dashboard đầy đủ

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className='flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <LayoutDashboard className='text-muted-foreground h-12 w-12' />
          </div>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Team overview dashboard sẽ được implement trong Story 3.1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-center text-sm'>
            🚧 Đang phát triển — Story 3.1: Team Overview Dashboard
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
