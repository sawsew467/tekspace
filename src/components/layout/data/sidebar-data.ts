import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  BarChart3,
  Bell,
  AlertTriangle,
  Settings,
  Users,
  Mail,
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
      logo: Bell,
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
      title: 'Team',
      items: [
        {
          title: 'Thành viên',
          url: '/team/members',
          icon: Users,
        },
        {
          title: 'Lời mời',
          url: '/team/invites',
          icon: Mail,
        },
        {
          title: 'Cài đặt nhóm',
          url: '/team/settings',
          icon: Settings,
        },
      ],
    },
  ],
}

