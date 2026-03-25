import * as React from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTenantStore } from '@/stores/tenant-store'

type Team = {
  id: string // UUID từ tenants table — dùng làm React key (không dùng name vì không unique)
  name: string
  logo: React.ElementType
  plan: string
}

type TeamSwitcherProps = {
  teams: Team[]
  onSwitch?: (teamId: string) => void
  onCreateTeam?: () => void
}

export function TeamSwitcher({ teams, onSwitch, onCreateTeam }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { activeTenantId } = useTenantStore()

  // Derive activeTeam từ store thay vì internal state — store là source of truth
  const activeTeam = teams.find((t) => t.id === activeTenantId) ?? teams[0]

  // Guard: nếu chưa có team nào, render placeholder
  if (!activeTeam) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' disabled>
            <div className='text-muted-foreground text-sm'>No team selected</div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              tooltip={activeTeam.name}
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg'>
                <activeTeam.logo className='size-8' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeTeam.name}
                </span>
                <span className='truncate text-xs'>{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Danh sách team
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              // Dùng team.id (UUID) làm key, không dùng name vì name không unique
              <DropdownMenuItem
                key={team.id}
                onClick={() => onSwitch?.(team.id)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-sm border'>
                  <team.logo className='size-4 shrink-0' />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className='gap-2 p-2' onClick={onCreateTeam}>
              <div className='flex size-6 items-center justify-center rounded-md border bg-background'>
                <Plus className='size-4' />
              </div>
              <div className='font-medium text-muted-foreground'>Tạo team mới</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
