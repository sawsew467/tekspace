import { useState, useEffect, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { Activity, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useTenantStore } from '@/stores/tenant-store'
import { PeriodNavigator } from '@/components/period-navigator'
import {
  type Period,
  getPeriodRange,
  isCurrentOrFuturePeriod,
} from '@/lib/period'
import {
  fetchTeamStatus,
  fetchSnapshotsForPeriod,
  fetchSessionsForPeriod,
  fetchSnapshotHistory,
} from '@/features/usage/services/usage.service'
import {
  latestPerSession,
  groupByUser,
  buildUsageChartData,
  periodToTimestampBounds,
  type SessionInput,
} from '@/features/usage/utils/usage-aggregate'
import type {
  UsageSnapshotRow,
  TeamStatusValue,
  UserUsageRow,
  SessionSummary,
} from '@/lib/usage-types'

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/usage')({
  head: () => ({
    meta: [{ title: 'Claude Usage — TekSpace' }],
  }),
  component: UsagePage,
})

// ── Chart config ───────────────────────────────────────────────────────────────

const chartConfig = {
  context_tokens: {
    label: 'Context tokens',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Nhãn hiển thị của user: name → email → user_id rút gọn. */
function userLabel(u: { name: string | null; email: string | null; user_id: string }): string {
  return u.name || u.email || `${u.user_id.slice(0, 8)}…`
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TeamStatusValue }) {
  if (status === 'active') {
    return (
      <Badge className='bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'>
        Active
      </Badge>
    )
  }
  if (status === 'idle') {
    return (
      <Badge variant='secondary'>
        Idle
      </Badge>
    )
  }
  return (
    <Badge variant='outline' className='text-muted-foreground'>
      Offline
    </Badge>
  )
}

// ── Context percent bar ────────────────────────────────────────────────────────

function CtxBar({ pct }: { pct: number }) {
  const isHigh = pct > 80
  return (
    <div className='flex items-center gap-2 min-w-[80px]'>
      <div className='h-1.5 flex-1 rounded-full bg-muted overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums shrink-0 ${isHigh ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        {pct}%
      </span>
    </div>
  )
}

// ── Snapshot history table (per session) ────────────────────────────────────────

function SnapshotHistoryTable({ history }: { history: UsageSnapshotRow[] }) {
  if (history.length === 0) {
    return (
      <p className='text-sm text-muted-foreground py-8 text-center'>
        Không có snapshot nào.
      </p>
    )
  }
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='text-xs'>Thời gian</TableHead>
            <TableHead className='text-xs'>Ctx%</TableHead>
            <TableHead className='text-xs'>Tokens</TableHead>
            <TableHead className='text-xs'>+Lines</TableHead>
            <TableHead className='text-xs'>−Lines</TableHead>
            <TableHead className='text-xs'>5h%</TableHead>
            <TableHead className='text-xs'>7d%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((snap) => (
            <TableRow key={snap.id}>
              <TableCell className='text-xs text-muted-foreground whitespace-nowrap'>
                {format(new Date(snap.created_at), 'dd/MM HH:mm')}
              </TableCell>
              <TableCell className='text-xs'>
                <span className={snap.context_percent > 80 ? 'text-destructive font-semibold' : ''}>
                  {snap.context_percent}%
                </span>
              </TableCell>
              <TableCell className='text-xs tabular-nums'>
                {snap.context_tokens.toLocaleString()}
              </TableCell>
              <TableCell className='text-xs tabular-nums text-green-600'>
                +{snap.lines_added.toLocaleString()}
              </TableCell>
              <TableCell className='text-xs tabular-nums text-destructive'>
                −{snap.lines_removed.toLocaleString()}
              </TableCell>
              <TableCell className='text-xs'>
                {snap.five_hour_pct != null ? `${snap.five_hour_pct}%` : '—'}
              </TableCell>
              <TableCell className='text-xs'>
                {snap.seven_day_pct != null ? `${snap.seven_day_pct}%` : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── User detail sheet (sessions → snapshot history) ─────────────────────────────

function UserDetailSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserUsageRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)

  const { data: history = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageSessionHistory, selectedSession?.session_id],
    queryFn: () => fetchSnapshotHistory(selectedSession!.session_id),
    enabled: open && !!selectedSession?.session_id,
    staleTime: 10_000,
  })

  const displayName = user ? userLabel(user) : 'User'

  // Đóng sheet → reset về danh sách session (đổi user reset qua key ở parent).
  const handleOpenChange = (v: boolean) => {
    if (!v) setSelectedSession(null)
    onOpenChange(v)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-lg overflow-y-auto'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Activity className='size-4' />
            {displayName}
          </SheetTitle>
          <SheetDescription>
            {user ? `${user.sessionCount} session · hoạt động gần nhất ${format(new Date(user.lastActivity), 'dd/MM HH:mm')}` : null}
          </SheetDescription>
        </SheetHeader>

        <div className='mt-4 px-4 pb-4 space-y-3'>
          {selectedSession ? (
            <>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  onClick={() => setSelectedSession(null)}
                >
                  <ChevronLeft className='size-3.5' /> Sessions
                </Button>
                <span className='text-xs text-muted-foreground truncate'>
                  {selectedSession.project_name ?? selectedSession.session_id}
                  {selectedSession.branch && <span className='ml-2'>branch: {selectedSession.branch}</span>}
                </span>
              </div>
              {isLoading ? (
                <div className='space-y-2'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className='h-10 w-full' />
                  ))}
                </div>
              ) : (
                <SnapshotHistoryTable history={history} />
              )}
            </>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='text-xs'>Project</TableHead>
                    <TableHead className='text-xs'>Branch</TableHead>
                    <TableHead className='text-xs'>Model</TableHead>
                    <TableHead className='text-xs'>Hoạt động</TableHead>
                    <TableHead className='text-xs'>Ctx%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user?.sessions.map((s) => (
                    <TableRow
                      key={s.session_id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => setSelectedSession(s)}
                    >
                      <TableCell className='text-sm'>{s.project_name ?? '—'}</TableCell>
                      <TableCell className='font-mono text-xs text-muted-foreground'>{s.branch ?? '—'}</TableCell>
                      <TableCell className='font-mono text-xs'>{s.model ?? '—'}</TableCell>
                      <TableCell className='text-xs text-muted-foreground whitespace-nowrap'>
                        {format(new Date(s.last_seen_at), 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell className='text-xs tabular-nums'>
                        {s.latest ? `${s.latest.context_percent}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Realtime hook ──────────────────────────────────────────────────────────────

function useUsageRealtime(tenantId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tenantId) return

    const channelName = `usage-snapshots-${tenantId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'usage_snapshots',
        },
        (payload) => {
          const row = payload.new as { tenant_id?: string }
          // Client-side tenant filter: only invalidate for the active tenant
          if (row.tenant_id !== tenantId) return

          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.usageSnapshots] })
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.usageTeamStatus] })
        }
      )
      .subscribe((status, err) => {
        if (import.meta.env.DEV) {
          if (status === 'CHANNEL_ERROR') {
            // eslint-disable-next-line no-console
            console.error('[Realtime] usage-snapshots channel error:', err)
          } else {
            // eslint-disable-next-line no-console
            console.log(`[Realtime] usage-snapshots channel status: ${status}`)
          }
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])
}

// ── User table columns ─────────────────────────────────────────────────────────

function useUserColumns(
  onRowClick: (row: UserUsageRow) => void,
  showLiveStatus: boolean,
): ColumnDef<UserUsageRow>[] {
  return [
    {
      accessorKey: 'user_id',
      header: 'Dev',
      cell: ({ row }) => (
        <button
          type='button'
          className='text-left text-xs underline-offset-2 hover:underline'
          onClick={() => onRowClick(row.original)}
        >
          {userLabel(row.original)}
        </button>
      ),
    },
    {
      accessorKey: 'model',
      header: 'Model',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.model ?? '—'}</span>
      ),
    },
    {
      id: 'sessions',
      header: 'Sessions',
      cell: ({ row }) => (
        <span className='text-xs tabular-nums'>{row.original.sessionCount}</span>
      ),
    },
    {
      id: 'ctx_pct',
      header: 'Ctx%',
      cell: ({ row }) => <CtxBar pct={row.original.latest?.context_percent ?? 0} />,
    },
    {
      id: 'quota_5h',
      header: 'Quota 5h',
      cell: ({ row }) => {
        const val = row.original.latest?.five_hour_pct
        return (
          <span className='text-xs tabular-nums text-muted-foreground'>
            {val != null ? `${val}%` : '—'}
          </span>
        )
      },
    },
    {
      id: 'quota_7d',
      header: 'Quota 7d',
      cell: ({ row }) => {
        const val = row.original.latest?.seven_day_pct
        return (
          <span className='text-xs tabular-nums text-muted-foreground'>
            {val != null ? `${val}%` : '—'}
          </span>
        )
      },
    },
    {
      id: 'lines',
      header: 'Lines',
      cell: ({ row }) => {
        const snap = row.original.latest
        if (!snap) return <span className='text-muted-foreground text-xs'>—</span>
        return (
          <span className='text-xs tabular-nums'>
            <span className='text-green-600'>+{snap.lines_added.toLocaleString()}</span>
            {' / '}
            <span className='text-destructive'>−{snap.lines_removed.toLocaleString()}</span>
          </span>
        )
      },
    },
    {
      id: 'status',
      header: showLiveStatus ? 'Status' : 'Hoạt động gần nhất',
      cell: ({ row }) => {
        if (showLiveStatus && row.original.status) {
          return <StatusBadge status={row.original.status} />
        }
        return (
          <span className='text-xs text-muted-foreground whitespace-nowrap'>
            {format(new Date(row.original.lastActivity), 'dd/MM HH:mm')}
          </span>
        )
      },
    },
  ]
}

// ── Stat cards ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className='text-2xl font-bold tabular-nums'>{value}</p>
        {sub && <p className='text-xs text-muted-foreground mt-1'>{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

function UsagePage() {
  const { activeTenantId } = useTenantStore()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [period, setPeriod] = useState<Period>({ granularity: 'day', anchor: today })
  const [selectedUser, setSelectedUser] = useState<UserUsageRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const isCurrent = isCurrentOrFuturePeriod(period)
  const { start, end } = getPeriodRange(period)
  const { startISO, endExclusiveISO } = periodToTimestampBounds(start, end)

  // Realtime chỉ cho kỳ hiện tại (xem kỳ cũ không bị nhảy dữ liệu).
  useUsageRealtime(isCurrent ? activeTenantId : null)

  // ── Queries ───────────────────────────────────────────────────────────────

  // Team status (live) — dùng cho status hiện tại + map email/name theo user.
  const { data: teamStatus = [], isLoading: isStatusLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageTeamStatus, activeTenantId],
    queryFn: () => fetchTeamStatus(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 15_000,
  })

  // Snapshots trong kỳ.
  const { data: periodSnapshots = [], isLoading: isSnapshotsLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageSnapshots, activeTenantId, startISO, endExclusiveISO],
    queryFn: () => fetchSnapshotsForPeriod(activeTenantId!, startISO, endExclusiveISO),
    enabled: !!activeTenantId,
    staleTime: 15_000,
  })

  // Sessions trong kỳ — chỉ cần cho kỳ quá khứ (kỳ hiện tại đã có từ teamStatus).
  const { data: periodSessions = [] } = useQuery({
    queryKey: [QUERY_KEYS.usageSessions, activeTenantId, startISO, endExclusiveISO],
    queryFn: () => fetchSessionsForPeriod(activeTenantId!, startISO, endExclusiveISO),
    enabled: !!activeTenantId && !isCurrent,
    staleTime: 15_000,
  })

  // ── Derived data ──────────────────────────────────────────────────────────

  const latestBySession = useMemo(() => latestPerSession(periodSnapshots), [periodSnapshots])

  // Map email/name theo user (từ team status live) để bổ sung cho session lịch sử.
  const identityByUser = useMemo(() => {
    const m = new Map<string, { email: string | null; name: string | null }>()
    for (const r of teamStatus) m.set(r.user_id, { email: r.email, name: r.name })
    return m
  }, [teamStatus])

  // Nguồn session: kỳ hiện tại = team status (có status); kỳ quá khứ = claude_sessions trong kỳ.
  const sessions = useMemo<SessionInput[]>(() => {
    if (isCurrent) return teamStatus
    return periodSessions.map((s) => ({
      session_id: s.session_id,
      user_id: s.user_id,
      tenant_id: s.tenant_id,
      email: identityByUser.get(s.user_id)?.email ?? null,
      name: identityByUser.get(s.user_id)?.name ?? null,
      model: s.model,
      project_name: s.project_name,
      branch: s.branch,
      started_at: s.started_at,
      last_seen_at: s.last_seen_at,
      status: undefined,
    }))
  }, [isCurrent, teamStatus, periodSessions, identityByUser])

  const userRows = useMemo(
    () => groupByUser(sessions, latestBySession),
    [sessions, latestBySession],
  )

  // Total context tokens = tổng latest-per-session trong kỳ.
  const totalContextTokens = useMemo(() => {
    let sum = 0
    for (const snap of latestBySession.values()) sum += snap.context_tokens ?? 0
    return sum
  }, [latestBySession])

  const activeCount = useMemo(() => {
    if (isCurrent) return teamStatus.filter((r) => r.status === 'active').length
    return userRows.length
  }, [isCurrent, teamStatus, userRows])

  const chartData = useMemo(
    () => buildUsageChartData(periodSnapshots, period.granularity),
    [periodSnapshots, period.granularity],
  )

  // ── Table ─────────────────────────────────────────────────────────────────

  const handleRowClick = (row: UserUsageRow) => {
    setSelectedUser(row)
    setSheetOpen(true)
  }

  const columns = useUserColumns(handleRowClick, isCurrent)

  const table = useReactTable({
    data: userRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isLoading = isStatusLoading || isSnapshotsLoading

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className='w-full px-4 md:px-6 py-6 space-y-6'>
      {/* Page header */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Activity className='size-5 text-muted-foreground shrink-0' />
          <h1 className='text-lg font-semibold'>Claude Usage</h1>
          {isCurrent && <span className='text-xs text-muted-foreground ml-1'>Live</span>}
        </div>
        <PeriodNavigator period={period} onChange={setPeriod} granularities={['day', 'week', 'month']} />
      </div>

      {/* Stat cards */}
      <div className='grid gap-4 sm:grid-cols-2'>
        {isLoading ? (
          <>
            <Skeleton className='h-24 w-full rounded-xl' />
            <Skeleton className='h-24 w-full rounded-xl' />
          </>
        ) : (
          <>
            <StatCard
              title='Total context tokens'
              value={totalContextTokens.toLocaleString()}
              sub='Tổng latest context_tokens mỗi session trong kỳ'
            />
            <StatCard
              title={isCurrent ? 'Active devs' : 'Devs hoạt động'}
              value={activeCount}
              sub={isCurrent ? 'Session đang active' : 'Số dev có hoạt động trong kỳ'}
            />
          </>
        )}
      </div>

      {/* Area chart: context tokens over time */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>Context tokens theo thời gian</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className='h-48 w-full' />
          ) : chartData.length === 0 ? (
            <div className='flex h-48 items-center justify-center text-sm text-muted-foreground'>
              Chưa có dữ liệu snapshot trong kỳ.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className='h-48 w-full'>
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray='3 3' className='stroke-border' />
                <XAxis
                  dataKey='label'
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval='preserveStartEnd'
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        typeof value === 'number' ? value.toLocaleString() : value,
                        'tokens',
                      ]}
                      labelFormatter={(label) => `${label}`}
                    />
                  }
                />
                <Area
                  type='monotone'
                  dataKey='context_tokens'
                  stroke='var(--color-context_tokens)'
                  fill='var(--color-context_tokens)'
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* User table */}
      <section aria-label='Team usage table'>
        <h2 className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3'>
          Team — theo dev
        </h2>
        {isLoading ? (
          <div className='space-y-2 rounded-lg border border-border p-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : (
          <ClickableDataTable
            table={table}
            columns={columns}
            onRowClick={handleRowClick}
            emptyMessage='Không có hoạt động nào trong kỳ. Chạy Claude CLI với TEAM_USAGE_TOKEN để bắt đầu.'
          />
        )}
      </section>

      {/* User detail sheet */}
      <UserDetailSheet
        key={selectedUser?.user_id ?? 'none'}
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}

// ── ClickableDataTable ─────────────────────────────────────────────────────────
// Inline table with per-row click handler for the user-detail sheet trigger.

function ClickableDataTable({
  table,
  columns,
  onRowClick,
  emptyMessage,
}: {
  table: TanstackTable<UserUsageRow>
  columns: ColumnDef<UserUsageRow>[]
  onRowClick: (row: UserUsageRow) => void
  emptyMessage?: string
}) {
  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn('cursor-pointer hover:bg-muted/50')}
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className='h-24 text-center text-sm text-muted-foreground'>
                {emptyMessage ?? 'Không có kết quả.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
