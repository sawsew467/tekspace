import { createFileRoute, redirect } from '@tanstack/react-router'
import { ImportPage } from '@/features/ai-import/components/ImportPage'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'

export const Route = createFileRoute('/_app/admin/import')({
  beforeLoad: () => {
    // Role check: owner or manager only (not member, not viewer)
    // Use the tenant store to get active role
    const { activeRole } = useTenantStore.getState()
    if (!activeRole || (activeRole !== 'owner' && activeRole !== 'manager')) {
      throw redirect({ to: ROUTES.app.dashboard })
    }
  },
  component: ImportPageWrapper,
})

function ImportPageWrapper() {
  const { activeTenantId } = useTenantStore()

  if (!activeTenantId) {
    // Should not happen due to redirect in _app route, but safety check
    return (
      <div className='flex items-center justify-center py-12 text-muted-foreground'>
        Không có team nào được chọn.
      </div>
    )
  }

  return <ImportPage tenantId={activeTenantId} />
}
