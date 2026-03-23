import { cn } from '@/lib/utils'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppTitle() {
  const { setOpenMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className={cn(
            'gap-0 py-0 hover:bg-transparent active:bg-transparent',
            isCollapsed && 'justify-center'
          )}
          onClick={() => {
            setOpenMobile(false)
            window.location.href = '/dashboard'
          }}
        >
          <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm'>
            TS
          </div>
          {!isCollapsed && (
            <div className='ml-2 grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-bold'>TekSpace</span>
              <span className='truncate text-xs'>Team Workspace</span>
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
