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

type Team = {
  id: string // UUID từ tenants table — dùng làm React key (không dùng name vì không unique)
  name: string
  logo: React.ElementType
  plan: string
}

type TeamSwitcherProps = {
  teams: Team[]
  // onSwitch sẽ được implement trong Story 1.7 để trigger auth.refreshSession()
  onSwitch?: (teamId: string) => void
}

export function TeamSwitcher({ teams, onSwitch }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()

  // Guard: nếu chưa có team nào, render placeholder
  const [activeTeam, setActiveTeam] = React.useState<Team | undefined>(teams[0])

  // Sync khi teams list thay đổi (ví dụ sau khi fetch xong)
  React.useEffect(() => {
    if (!activeTeam && teams.length > 0) {
      setActiveTeam(teams[0])
    }
  }, [teams, activeTeam])

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

  const handleSwitch = (team: Team) => {
    setActiveTeam(team)
    // Story 1.7: gọi onSwitch để trigger auth.refreshSession() với active_tenant_id mới
    onSwitch?.(team.id)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg'>
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
              Teams
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              // Dùng team.id (UUID) làm key, không dùng name vì name không unique
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleSwitch(team)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-sm border'>
                  <team.logo className='size-4 shrink-0' />
                </div>
                {team.name}
                {/* TODO Story 1.7: wire keyboard shortcuts thực sự (hiện tại chỉ decorative) */}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className='gap-2 p-2'>
              <div className='flex size-6 items-center justify-center rounded-md border bg-background'>
                <Plus className='size-4' />
              </div>
              <div className='font-medium text-muted-foreground'>Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
