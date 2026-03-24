import { useState } from 'react'
import { Search, Users, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ReportStatusBadge, type ReportStatus } from '@/features/daily-report/components/ReportStatusBadge'
import { DailyReportView } from '@/features/daily-report/components/DailyReportView'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import type { TeamReportRow, DailyReport } from '@/features/daily-report/services/daily-report.service'

type StatusFilter = 'all' | ReportStatus

type MemberReportEntry = {
  member: TenantMemberWithUser
  report: TeamReportRow | null
  status: ReportStatus
  isSelf: boolean  // F12: đánh dấu chính là manager đang đăng nhập
}

type Props = {
  members: TenantMemberWithUser[]
  reports: TeamReportRow[]
  timezone: string
  currentUserId: string | null  // F12
}

export function TeamReportList({ members, reports, timezone, currentUserId }: Props) {
  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)

  // Merge: với mỗi member, tìm report tương ứng theo user_id
  const reportsByUserId = new Map(reports.map(r => [r.user_id, r]))

  const entriesRaw: MemberReportEntry[] = members.map(member => {
    const report = reportsByUserId.get(member.user_id) ?? null
    const status: ReportStatus = !report ? 'missing' : report.is_late ? 'late' : 'submitted'
    const isSelf = member.user_id === currentUserId
    return { member, report, status, isSelf }
  })
  // F12: pin bản thân lên đầu danh sách
  const entries = [...entriesRaw].sort((a, b) =>
    a.isSelf === b.isSelf ? 0 : a.isSelf ? -1 : 1,
  )

  // Apply filters
  const filtered = entries
    .filter(e => statusFilter === 'all' || e.status === statusFilter)
    .filter(e => {
      if (nameFilter === '') return true
      // F7: null guard cho full_name
      const name = e.member.users.full_name ?? ''
      return name.toLowerCase().includes(nameFilter.toLowerCase())
    })

  // F9: Summary counts luôn tính trên toàn bộ team (không phụ thuộc filter)
  const submittedCount = entries.filter(e => e.status === 'submitted').length
  const lateCount = entries.filter(e => e.status === 'late').length
  const missingCount = entries.filter(e => e.status === 'missing').length
  const isFiltered = statusFilter !== 'all' || nameFilter !== ''

  return (
    <div className='space-y-4'>
      {/* Summary — luôn hiển thị tổng cả team, bất kể filter đang active */}
      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground'>
        <span>
          <span className='font-medium text-foreground'>{submittedCount + lateCount}</span>/
          {entries.length} đã nộp
        </span>
        {lateCount > 0 && (
          <span className='text-destructive font-medium'>{lateCount} nộp muộn</span>
        )}
        {missingCount > 0 && (
          <span>
            <span className='font-medium text-foreground'>{missingCount}</span> chưa nộp
          </span>
        )}
        {/* F9: hiển thị số kết quả đang lọc để tránh nhầm lẫn với totals */}
        {isFiltered && filtered.length !== entries.length && (
          <span className='ml-auto text-xs italic'>
            Đang lọc: {filtered.length}/{entries.length}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className='flex flex-col sm:flex-row gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Tìm theo tên...'
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className='pl-9'
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={val => setStatusFilter(val as StatusFilter)}
        >
          <SelectTrigger className='w-full sm:w-44'>
            <SelectValue placeholder='Tất cả' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Tất cả</SelectItem>
            <SelectItem value='submitted'>Đã nộp</SelectItem>
            <SelectItem value='late'>Nộp muộn</SelectItem>
            <SelectItem value='missing'>Chưa nộp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-10 text-center text-muted-foreground'>
          <Users className='h-10 w-10 mb-3 opacity-30' />
          <p className='text-sm'>Không tìm thấy kết quả phù hợp.</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {filtered.map(({ member, report, status, isSelf }) => {
            const isOpen = openMemberId === member.user_id
            const canExpand = report !== null
            // F7: null guard cho full_name
            const fullName = member.users.full_name ?? ''

            return (
              <Collapsible
                key={member.user_id}
                open={isOpen && canExpand}
                onOpenChange={open => setOpenMemberId(open ? member.user_id : null)}
              >
                {/* F11: khi mở, trigger mất bottom radius + border-bottom để "nối" với content */}
                <CollapsibleTrigger
                  className={cn(
                    'flex w-full items-center gap-3 border p-3 text-left transition-colors',
                    isOpen && canExpand
                      ? 'rounded-t-lg border-b-0 bg-muted/30'
                      : 'rounded-lg',
                    canExpand
                      ? 'hover:bg-muted/50 cursor-pointer'
                      : 'cursor-default',
                    // F12: ring nhẹ cho self entry
                    isSelf && 'ring-1 ring-primary/30',
                  )}
                  disabled={!canExpand}
                  // F10: aria-disabled + tabIndex để screen reader và keyboard hoạt động đúng
                  aria-disabled={!canExpand}
                  tabIndex={canExpand ? 0 : -1}
                >
                  {/* Avatar */}
                  <Avatar className='h-8 w-8 shrink-0'>
                    <AvatarImage src={member.users.avatar_url ?? undefined} />
                    {/* F7: fallback với null guard */}
                    <AvatarFallback className='text-xs'>
                      {fullName ? fullName.slice(0, 2).toUpperCase() : '??'}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + hours */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <p className='text-sm font-medium truncate'>{fullName || '—'}</p>
                      {/* F12: badge "(Bạn)" cho manager đang đăng nhập */}
                      {isSelf && (
                        <span className='shrink-0 text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full'>
                          Bạn
                        </span>
                      )}
                    </div>
                    {report && (
                      <p className='text-xs text-muted-foreground'>{report.hours_logged}h</p>
                    )}
                  </div>

                  {/* Status badge + chevron */}
                  <div className='flex items-center gap-2 shrink-0'>
                    <ReportStatusBadge status={status} />
                    {canExpand && (
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    )}
                  </div>
                </CollapsibleTrigger>

                {/* Detail — reuse DailyReportView */}
                {canExpand && report && (
                  <CollapsibleContent>
                    {/* F11: border-x + border-b + rounded-b-lg để nối liền với trigger ở trên */}
                    <div className='border-x border-b rounded-b-lg px-4 pb-4 pt-3'>
                      <DailyReportView
                        report={reportAsDailyReport(report)}
                        timezone={timezone}
                      />
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Adapter: chuyển TeamReportRow → DailyReport shape mà DailyReportView nhận.
 * Strip embedded `users` field (chỉ dùng cho merge logic, không cần cho rendering).
 * tasks đã đồng nhất type với DailyReport['tasks'] — DailyReportView guards với Array.isArray.
 */
function reportAsDailyReport({ users: _users, ...rest }: TeamReportRow): DailyReport {
  return rest as DailyReport
}
