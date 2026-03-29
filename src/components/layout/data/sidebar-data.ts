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
  Home,
} from 'lucide-react'
import { type SidebarData } from '../types'
import { ROUTES } from '@/lib/routes'

// TekSpace sidebar data
// Navigation sử dụng ROUTES constant — single source of truth cho path strings
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
          url: ROUTES.app.dashboard,
          icon: Home,
        },
        {
          title: 'Team Schedule',
          url: ROUTES.app.teamSchedule,
          icon: LayoutDashboard,
        },
        {
          title: 'Analytics',
          url: ROUTES.app.analytics,
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'Work',
      items: [
        {
          title: 'Lịch làm việc',
          url: ROUTES.app.schedule,
          icon: CalendarDays,
        },
        {
          title: 'Báo cáo ngày',
          url: ROUTES.app.dailyReport,
          icon: FileText,
        },
        {
          title: 'Notifications',
          url: ROUTES.app.notifications,
          icon: Bell,
        },
        {
          title: 'Incidents',
          url: ROUTES.app.incidents,
          icon: AlertTriangle,
        },
      ],
    },
    {
      title: 'Team',
      items: [
        {
          title: 'Thành viên',
          url: ROUTES.app.team.members,
          icon: Users,
          // roles: all roles — member được xem danh sách read-only
        },
        {
          title: 'Lời mời',
          url: ROUTES.app.team.invites,
          icon: Mail,
          roles: ['owner', 'manager'],
        },
        {
          title: 'Cài đặt nhóm',
          url: ROUTES.app.team.settings,
          icon: Settings,
          roles: ['owner'],
        },
      ],
    },
  ],
}
