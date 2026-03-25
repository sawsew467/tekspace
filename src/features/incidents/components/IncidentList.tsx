import { useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  INCIDENT_CATEGORY_LABELS,
  CATEGORY_BADGE_VARIANT,
} from '@/features/incidents/schemas/incident.schema'
import type { Incident, IncidentAppeal } from '@/features/incidents/services/incident.service'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'

// Badge variant per category — defined in incident.schema.ts (shared with detail page)

interface IncidentListProps {
  incidents: Incident[]
  isLoading: boolean
  members: TenantMemberWithUser[]
  userTimezone: string | null
  appeals: IncidentAppeal[]
  canAppeal: boolean                         // true = member; false = manager/owner
  onAppeal: (incidentId: string) => void     // callback mở AppealDialog
  onViewDetail?: (incidentId: string) => void  // cả member lẫn manager đều có thể navigate
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

function getMemberName(members: TenantMemberWithUser[], userId: string): string {
  return members.find((m) => m.user_id === userId)?.users.full_name ?? '(Thành viên đã rời)'
}

export function IncidentList({
  incidents,
  isLoading,
  members,
  userTimezone,
  appeals,
  canAppeal,
  onAppeal,
  onViewDetail,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: IncidentListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore) return
    // P-3: sync check — nếu sentinel đang trong viewport khi effect re-run (hasNextPage flip), trigger ngay
    if (hasNextPage && !isFetchingNextPage) {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight + 200) {
        onLoadMore()
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

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
      <div>
        <div className='flex flex-col items-center justify-center py-16 text-muted-foreground gap-3'>
          <ShieldAlert className='h-10 w-10 opacity-30' />
          <p className='text-sm'>Chưa có incident nào được ghi nhận.</p>
        </div>
        {/* P-1: sentinel luôn mount kể cả khi filtered empty — cho phép load thêm pages có data */}
        <div ref={sentinelRef} />
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

        // Tìm appeal cho incident này
        const appeal = appeals.find((a) => a.incident_id === incident.id)

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
                {/* Badge appeal status — cả member lẫn manager đều thấy (AC1) */}
                <Badge variant={appeal ? 'secondary' : 'outline'} className='text-xs'>
                  {appeal
                    ? (canAppeal ? 'Đã gửi appeal' : 'Đã appeal')
                    : 'Chưa appeal'}
                </Badge>
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                <time
                  dateTime={incident.created_at}
                  className='text-xs text-muted-foreground'
                >
                  {formattedDate}
                </time>
                {/* Xem chi tiết — hiển thị cho tất cả users khi onViewDetail được provide */}
                {onViewDetail && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-7 text-xs px-2'
                    onClick={() => onViewDetail(incident.id)}
                  >
                    Xem chi tiết →
                  </Button>
                )}
              </div>
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

            {/* Appeal section — member view */}
            {canAppeal && (
              appeal ? (
                // Đã có appeal — hiển thị response
                <div className='rounded-md bg-muted/50 border px-3 py-2 space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground'>Appeal của bạn:</p>
                  <p className='text-sm'>{appeal.response || '—'}</p>
                </div>
              ) : (
                // Chưa appeal — hiển thị button
                <Button
                  size='sm'
                  variant='outline'
                  className='h-7 text-xs'
                  onClick={() => onAppeal(incident.id)}
                >
                  Gửi Appeal
                </Button>
              )
            )}

            {/* Appeal section — manager/owner view (chỉ khi có appeal) */}
            {!canAppeal && appeal && (
              <div className='rounded-md bg-muted/50 border px-3 py-2 space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Appeal từ {getMemberName(members, appeal.member_id)}:
                </p>
                <p className='text-sm'>{appeal.response || '—'}</p>
              </div>
            )}
          </div>
        )
      })}
      <div ref={sentinelRef} className='py-2 flex justify-center'>
        {isFetchingNextPage && <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />}
        {hasNextPage === false && incidents.length > 0 && (
          <p className='text-xs text-muted-foreground'>Đã tải hết incidents</p>
        )}
      </div>
    </div>
  )
}
