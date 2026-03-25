import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { getMembers, type TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { usePermissions } from '@/hooks/use-permissions'
import { useIncidents } from '@/features/incidents/hooks/use-incidents'
import { useAppeals } from '@/features/incidents/hooks/use-appeals'
import { useOutcomeNotes } from '@/features/incidents/hooks/use-outcome-notes'
import { useCreateOutcomeNote } from '@/features/incidents/hooks/use-create-outcome-note'
import {
  createOutcomeNoteSchema,
  type CreateOutcomeNoteInput,
} from '@/features/incidents/schemas/outcome-note.schema'
import {
  INCIDENT_CATEGORY_LABELS,
  CATEGORY_BADGE_VARIANT,
} from '@/features/incidents/schemas/incident.schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'

// Badge variant per category — shared constant từ incident.schema.ts (có proper typing)

// Helper: resolve member name từ array
function getMemberName(members: TenantMemberWithUser[], userId: string): string {
  return members.find((m) => m.user_id === userId)?.users.full_name ?? '(Thành viên đã rời)'
}

// Helper: validate timezone string
function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Helper: format date với timezone
function formatDate(dateStr: string, timezone: string | null): string {
  const tz = timezone ?? 'UTC'
  const utcDate = new Date(dateStr)
  if (timezone !== null) {
    const zonedDate = toZonedTime(utcDate, tz)
    return format(zonedDate, 'dd/MM/yyyy HH:mm', { locale: vi })
  }
  return format(utcDate, 'dd/MM/yyyy HH:mm', { locale: vi })
}

export const Route = createFileRoute('/_app/incidents/$incidentId')({
  head: () => ({
    meta: [{ title: 'Chi tiết Incident — TekSpace' }],
  }),
  component: IncidentDetailPage,
})

function IncidentDetailPage() {
  const { incidentId } = Route.useParams()
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()
  const { canCreateIncident } = usePermissions()

  // Reuse existing cached queries — tránh tạo query riêng cho incident/appeal
  const { data: incidents = [], isLoading: isIncidentsLoading } = useIncidents(activeTenantId)
  const { data: appeals   = [], isLoading: isAppealsLoading }   = useAppeals(activeTenantId)

  // Members list để resolve names
  const { data: members = [] } = useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
    queryFn:  () => getMembers(activeTenantId!),
    staleTime: 60 * 1000,
    enabled:   !!activeTenantId,
  })

  // User profile để lấy timezone
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn:  () => getUserProfile(user!.id),
    enabled:  !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  const timezone = useMemo((): string | null => {
    if (isProfileLoading) return null
    const raw = userProfile?.timezone
    return isValidTimezone(raw) ? raw : 'UTC'
  }, [userProfile?.timezone, isProfileLoading])

  // Outcome notes — query mới cho bảng mới
  const { data: outcomeNotes = [], isLoading: isNotesLoading } = useOutcomeNotes(
    incidentId,
    activeTenantId
  )

  const createOutcomeNote = useCreateOutcomeNote()

  // Find specific incident & appeal từ cached data
  const incident = incidents.find((i) => i.id === incidentId)
  const appeal   = appeals.find((a) => a.incident_id === incidentId)

  // Outcome note form
  const form = useForm<CreateOutcomeNoteInput>({
    resolver: zodResolver(createOutcomeNoteSchema),
    defaultValues: { note: '' },
  })

  const handleSubmitNote = form.handleSubmit((data) => {
    if (!activeTenantId || !user || !incident) return
    createOutcomeNote.mutate(
      {
        tenantId:   activeTenantId,
        incidentId,
        managerId:  user.id,
        memberId:   incident.member_id,
        note:       data.note,
      },
      {
        onSuccess: () => form.reset(),
      }
    )
  })

  // Loading state — chờ cả incidents và appeals để tránh flash khi section appeal xuất hiện đột ngột
  if (isIncidentsLoading || isAppealsLoading || isProfileLoading) {
    return (
      <PageContainer className='space-y-4'>
        <Skeleton className='h-6 w-32' />
        <Skeleton className='h-40 w-full rounded-lg' />
        <Skeleton className='h-24 w-full rounded-lg' />
      </PageContainer>
    )
  }

  // Not found (sau khi incidents đã load xong)
  if (!incident) {
    return (
      <PageContainer className='space-y-3'>
        <Link
          to='/incidents'
          className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Quay lại Incidents
        </Link>
        <p className='text-sm text-muted-foreground'>
          Incident không tồn tại hoặc bạn không có quyền xem.
        </p>
      </PageContainer>
    )
  }

  const memberName  = getMemberName(members, incident.member_id)
  const managerName = getMemberName(members, incident.manager_id)
  const categoryLabel  = INCIDENT_CATEGORY_LABELS[incident.category] ?? incident.category
  const badgeVariant   = CATEGORY_BADGE_VARIANT[incident.category]   ?? 'outline'

  return (
    <PageContainer className='space-y-5'>
      {/* Back navigation + Header */}
      <div className='space-y-1'>
        <Link
          to='/incidents'
          className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Quay lại Incidents
        </Link>
        <h1 className='text-xl font-bold'>Chi tiết Incident</h1>
      </div>

      {/* Section 1: Incident Details */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Thông tin Incident</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex items-center gap-2'>
            <Badge variant={badgeVariant}>{categoryLabel}</Badge>
          </div>
          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div>
              <p className='text-xs text-muted-foreground mb-0.5'>Thành viên</p>
              <p className='font-medium'>{memberName}</p>
            </div>
            <div>
              <p className='text-xs text-muted-foreground mb-0.5'>Ghi nhận bởi</p>
              <p className='font-medium'>{managerName}</p>
            </div>
            <div>
              <p className='text-xs text-muted-foreground mb-0.5'>Thời gian</p>
              <p className='font-medium'>{formatDate(incident.created_at, timezone)}</p>
            </div>
          </div>
          <div>
            <p className='text-xs text-muted-foreground mb-1'>Ghi chú</p>
            <p className='text-sm whitespace-pre-wrap'>{incident.note}</p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Appeal (chỉ hiển thị khi có appeal) */}
      {appeal && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Appeal của thành viên</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            <p className='text-xs text-muted-foreground'>
              Gửi lúc: {formatDate(appeal.created_at, timezone)}
            </p>
            <p className='text-sm whitespace-pre-wrap'>{appeal.response}</p>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Outcome Notes */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Ghi chú Manager</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Existing notes list (chronological — cũ nhất trước) */}
          {isNotesLoading ? (
            <div className='space-y-2'>
              <Skeleton className='h-12 w-full rounded' />
              <Skeleton className='h-12 w-full rounded' />
            </div>
          ) : outcomeNotes.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Chưa có ghi chú nào.</p>
          ) : (
            <div className='space-y-3'>
              {outcomeNotes.map((n) => (
                <div
                  key={n.id}
                  className='rounded-md bg-muted/50 border px-3 py-2 space-y-1'
                >
                  <p className='text-xs text-muted-foreground'>
                    {getMemberName(members, n.manager_id)} •{' '}
                    {formatDate(n.created_at, timezone)}
                  </p>
                  <p className='text-sm whitespace-pre-wrap'>{n.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add note form — chỉ manager/owner */}
          {canCreateIncident && (
            <form onSubmit={handleSubmitNote} className='space-y-2 pt-2 border-t'>
              <Textarea
                {...form.register('note')}
                placeholder='Thêm ghi chú về incident này...'
                rows={3}
                className='resize-none'
              />
              {form.formState.errors.note && (
                <p className='text-xs text-destructive'>
                  {form.formState.errors.note.message}
                </p>
              )}
              <Button
                type='submit'
                size='sm'
                disabled={createOutcomeNote.isPending}
              >
                {createOutcomeNote.isPending ? 'Đang lưu...' : 'Thêm ghi chú'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
