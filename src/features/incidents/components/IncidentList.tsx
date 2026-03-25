import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  INCIDENT_CATEGORY_LABELS,
} from '@/features/incidents/schemas/incident.schema'
import type { Incident } from '@/features/incidents/services/incident.service'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'

// Badge variant per category
const CATEGORY_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  policy_violation: 'destructive',
  late_schedule:    'secondary',
  missed_report:    'secondary',
  low_commitment:   'outline',
}

interface IncidentListProps {
  incidents: Incident[]
  isLoading: boolean
  members: TenantMemberWithUser[]
  userTimezone: string | null
}

function getMemberName(members: TenantMemberWithUser[], userId: string): string {
  return members.find((m) => m.user_id === userId)?.users.full_name ?? '(Thành viên đã rời)'
}

export function IncidentList({
  incidents,
  isLoading,
  members,
  userTimezone,
}: IncidentListProps) {
  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className='h-24 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-muted-foreground gap-3'>
        <ShieldAlert className='h-10 w-10 opacity-30' />
        <p className='text-sm'>Chưa có incident nào được ghi nhận.</p>
      </div>
    )
  }

  const tz = userTimezone ?? 'UTC'

  return (
    <div className='space-y-3'>
      {incidents.map((incident) => {
        const utcDate = incident.created_at ? new Date(incident.created_at) : new Date()
        const zonedDate = toZonedTime(utcDate, tz)
        const formattedDate = userTimezone !== null
          ? format(zonedDate, 'dd/MM/yyyy HH:mm', { locale: vi })
          : format(utcDate, 'dd/MM/yyyy HH:mm', { locale: vi })

        const memberName  = getMemberName(members, incident.member_id)
        const managerName = getMemberName(members, incident.manager_id)
        const categoryLabel = INCIDENT_CATEGORY_LABELS[incident.category] ?? incident.category
        const badgeVariant = CATEGORY_BADGE_VARIANT[incident.category] ?? 'outline'

        // Truncate note nếu dài
        const NOTE_LIMIT = 120
        const isLong = incident.note.length > NOTE_LIMIT
        const displayNote = isLong
          ? incident.note.slice(0, NOTE_LIMIT) + '…'
          : incident.note

        return (
          <div
            key={incident.id}
            className='rounded-lg border bg-card p-4 space-y-2'
          >
            {/* Header row */}
            <div className='flex items-start justify-between gap-2'>
              <div className='flex items-center gap-2 flex-wrap'>
                <Badge variant={badgeVariant} className='shrink-0'>
                  {categoryLabel}
                </Badge>
                <span className='text-sm font-medium'>{memberName}</span>
                <span className='text-xs text-muted-foreground'>
                  — ghi nhận bởi {managerName}
                </span>
              </div>
              <time
                dateTime={incident.created_at}
                className='shrink-0 text-xs text-muted-foreground'
              >
                {formattedDate}
              </time>
            </div>

            {/* Note — truncated with tooltip if long */}
            {isLong ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className='text-sm text-muted-foreground cursor-help'>
                      {displayNote}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent
                    side='bottom'
                    className='max-w-sm whitespace-pre-wrap text-xs'
                  >
                    {incident.note}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <p className='text-sm text-muted-foreground'>{incident.note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
