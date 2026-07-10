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
import { Activity } from 'lucide-react'
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
import type {
  UsageTeamStatusRow,
  UsageSnapshotRow,
  TeamTableRow,
  TeamStatusValue,
} from '@/lib/usage-types'

// ── Untyped client helper ─────────────────────────────────────────────────────
// The generated Database type does not yet include the usage-tracking tables
// (migration applied locally but not regenerated against cloud).
// We cast through `unknown` at the query boundary only, keeping all call-site
// types explicit via our local UsageTeamStatusRow / UsageSnapshotRow types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any }

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

// ── Data helpers ───────────────────────────────────────────────────────────────

async function fetchTeamStatus(tenantId: string): Promise<UsageTeamStatusRow[]> {
  // Scope to the ACTIVE tenant. RLS allows any tenant the user is a member of
  // (membership-based so realtime works), so the active-tenant filter must be
  // applied here — otherwise a multi-tenant user sees every tenant's usage merged.
  const { data, error } = await db.from('usage_team_status')
    .select('session_id, user_id, email, tenant_id, model, project_hash, project_name, branch, started_at, last_seen_at, status')
    .eq('tenant_id', tenantId)
    .order('last_seen_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageTeamStatusRow[]
}

async function fetchLatestSnapshots(tenantId: string): Promise<UsageSnapshotRow[]> {
  // Fetch all snapshots ordered by created_at desc so we can pick the latest per session client-side.
  // context_tokens is a point-in-time value, so we take only the most recent per session.
  const { data, error } = await db.from('usage_snapshots')
    .select('id, session_id, user_id, tenant_id, context_percent, context_tokens, lines_added, lines_removed, five_hour_pct, seven_day_pct, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageSnapshotRow[]
}

async function fetchSnapshotHistory(sessionId: string): Promise<UsageSnapshotRow[]> {
  const { data, error } = await db.from('usage_snapshots')
    .select('id, session_id, user_id, tenant_id, context_percent, context_tokens, lines_added, lines_removed, five_hour_pct, seven_day_pct, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageSnapshotRow[]
}

/** Returns the latest snapshot per session_id (snapshots must be ordered by created_at DESC) */
function latestPerSession(snapshots: UsageSnapshotRow[]): Map<string, UsageSnapshotRow> {
  const map = new Map<string, UsageSnapshotRow>()
  for (const snap of snapshots) {
    if (!map.has(snap.session_id)) {
      map.set(snap.session_id, snap)
    }
  }
  return map
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

// ── Session history sheet ──────────────────────────────────────────────────────

function SessionHistorySheet({
  row,
  open,
  onOpenChange,
}: {
  row: TeamTableRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageSessionHistory, row?.session_id],
    queryFn: () => fetchSnapshotHistory(row!.session_id),
    enabled: open && !!row?.session_id,
    staleTime: 10_000,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-lg overflow-y-auto'>
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Activity className='size-4' />
            {row?.project_name ?? row?.session_id ?? 'Session'}
          </SheetTitle>
          <SheetDescription>
            {row?.model && <span className='font-mono text-xs'>{row.model}</span>}
            {row?.branch && <span className='ml-2 text-xs'>branch: {row.branch}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className='mt-4 px-4 pb-4'>
          {isLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className='text-sm text-muted-foreground py-8 text-center'>
              Không có snapshot nào.
            </p>
          ) : (
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

// ── Team table columns ─────────────────────────────────────────────────────────

function useTeamColumns(
  onRowClick: (row: TeamTableRow) => void
): ColumnDef<TeamTableRow>[] {
  return [
    {
      accessorKey: 'user_id',
      header: 'Dev',
      cell: ({ row }) => {
        return(
        <button
          type='button'
          className='text-left font-mono text-xs underline-offset-2 hover:underline text-muted-foreground'
          onClick={() => onRowClick(row.original)}
        >
          {row.original.email ?? row.original.user_id.slice(0, 8) + '…'}
        </button>
      )},
    },
    {
      accessorKey: 'model',
      header: 'Model',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.model}</span>
      ),
    },
    {
      accessorKey: 'project_name',
      header: 'Project',
      cell: ({ row }) => (
        <span className='text-sm'>{row.original.project_name ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'branch',
      header: 'Branch',
      cell: ({ row }) => (
        <span className='font-mono text-xs text-muted-foreground'>
          {row.original.branch ?? '—'}
        </span>
      ),
    },
    {
      id: 'ctx_pct',
      header: 'Ctx%',
      cell: ({ row }) => {
        const pct = row.original.latest?.context_percent ?? 0
        return <CtxBar pct={pct} />
      },
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

// ── Chart data builder ─────────────────────────────────────────────────────────

interface ChartPoint {
  time: string
  context_tokens: number
}

/** Build area chart data: sum of the latest context_tokens per session at each timestamp bucket.
 *  We use all snapshots ordered by created_at and bucket by minute for readability. */
function buildChartData(snapshots: UsageSnapshotRow[]): ChartPoint[] {
  if (snapshots.length === 0) return []

  // Sort ascending for chart
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Group by minute bucket, summing context_tokens
  const buckets = new Map<string, number>()
  for (const snap of sorted) {
    const d = new Date(snap.created_at)
    // Floor to minute
    d.setSeconds(0, 0)
    const key = d.toISOString()
    buckets.set(key, (buckets.get(key) ?? 0) + snap.context_tokens)
  }

  return Array.from(buckets.entries()).map(([iso, tokens]) => ({
    time: format(new Date(iso), 'HH:mm'),
    context_tokens: tokens,
  }))
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
  const [selectedRow, setSelectedRow] = useState<TeamTableRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Subscribe to realtime updates
  useUsageRealtime(activeTenantId)

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: teamStatus = [], isLoading: isStatusLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageTeamStatus, activeTenantId],
    queryFn: () => fetchTeamStatus(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 15_000,
  })

  const { data: allSnapshots = [], isLoading: isSnapshotsLoading } = useQuery({
    queryKey: [QUERY_KEYS.usageSnapshots, activeTenantId],
    queryFn: () => fetchLatestSnapshots(activeTenantId!),
    enabled: !!activeTenantId,
    staleTime: 15_000,
  })

  // ── Derived data ──────────────────────────────────────────────────────────

  const latestBySession = useMemo(() => latestPerSession(allSnapshots), [allSnapshots])

  // Total context_tokens: sum of latest snapshot per session (not a naive sum of all snapshots)
  const totalContextTokens = useMemo(() => {
    let sum = 0
    for (const snap of latestBySession.values()) {
      sum += snap.context_tokens
    }
    return sum
  }, [latestBySession])

  const activeDevCount = useMemo(
    () => teamStatus.filter((r) => r.status === 'active').length,
    [teamStatus]
  )

  // Enrich team status rows with latest snapshot
  const teamRows = useMemo<TeamTableRow[]>(
    () =>
      teamStatus.map((row) => ({
        ...row,
        latest: latestBySession.get(row.session_id),
      })),
    [teamStatus, latestBySession]
  )

  // Chart data from all snapshots
  const chartData = useMemo(() => buildChartData(allSnapshots), [allSnapshots])

  // ── Table ─────────────────────────────────────────────────────────────────

  const handleRowClick = (row: TeamTableRow) => {
    setSelectedRow(row)
    setSheetOpen(true)
  }

  const columns = useTeamColumns(handleRowClick)

  const table = useReactTable({
    data: teamRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const isLoading = isStatusLoading || isSnapshotsLoading

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className='w-full px-4 md:px-6 py-6 space-y-6'>
      {/* Page header */}
      <div className='flex items-center gap-2'>
        <Activity className='size-5 text-muted-foreground shrink-0' />
        <h1 className='text-lg font-semibold'>Claude Usage</h1>
        <span className='text-xs text-muted-foreground ml-1'>Live</span>
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
              sub='Sum of latest context_tokens per active session'
            />
            <StatCard
              title='Active devs'
              value={activeDevCount}
              sub='Sessions with status = active right now'
            />
          </>
        )}
      </div>

      {/* Area chart: context tokens over time */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>Context tokens over time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className='h-48 w-full' />
          ) : chartData.length === 0 ? (
            <div className='flex h-48 items-center justify-center text-sm text-muted-foreground'>
              Chưa có dữ liệu snapshot.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className='h-48 w-full'>
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray='3 3' className='stroke-border' />
                <XAxis
                  dataKey='time'
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

      {/* Team table */}
      <section aria-label='Team usage table'>
        <h2 className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3'>
          Team — sessions
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
            emptyMessage='Không có session nào. Chạy Claude CLI với TEAM_USAGE_TOKEN để bắt đầu.'
          />
        )}
      </section>

      {/* Session history sheet */}
      <SessionHistorySheet
        row={selectedRow}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}

// ── ClickableDataTable ─────────────────────────────────────────────────────────
// Inline table with per-row click handler for the session-history sheet trigger.

function ClickableDataTable({
  table,
  columns,
  onRowClick,
  emptyMessage,
}: {
  table: TanstackTable<TeamTableRow>
  columns: ColumnDef<TeamTableRow>[]
  onRowClick: (row: TeamTableRow) => void
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
