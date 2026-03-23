import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

type AppHeaderProps = {
  fixed?: boolean
  children?: React.ReactNode
}

export function AppHeader({ fixed, children }: AppHeaderProps) {
  return (
    <Header fixed={fixed}>
      {children}
      <div className='ml-auto flex items-center space-x-4'>
        <ThemeSwitch />
        <ProfileDropdown />
      </div>
    </Header>
  )
}
