import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  BarChart3,
  Bell,
  AlertTriangle,
  Settings,
  UserCog,
  Users,
  Building2,
} from 'lucide-react'
import { type SidebarData } from '../types'

// TekSpace sidebar data — sẽ được điền đầy đủ trong Story 1.2+
// Navigation sử dụng ROUTES constant (import lúc cần runtime)
export const sidebarData: SidebarData = {
  user: {
    name: 'User',
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: 'TekSpace',
      logo: Building2,
      plan: 'Team Workspace',
    },
  ],
  navGroups: [
    {
      title: 'Overview',
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'Analytics',
          url: '/analytics',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'Work',
      items: [
        {
          title: 'Schedule',
          url: '/schedule',
          icon: CalendarDays,
        },
        {
          title: 'Daily Report',
          url: '/daily-report',
          icon: FileText,
        },
        {
          title: 'Notifications',
          url: '/notifications',
          icon: Bell,
        },
        {
          title: 'Incidents',
          url: '/incidents',
          icon: AlertTriangle,
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          title: 'Profile',
          url: '/settings/profile',
          icon: UserCog,
        },
        {
          title: 'Team',
          url: '/settings/team',
          icon: Users,
        },
        {
          title: 'App Settings',
          url: '/settings/app',
          icon: Settings,
        },
      ],
    },
  ],
}
