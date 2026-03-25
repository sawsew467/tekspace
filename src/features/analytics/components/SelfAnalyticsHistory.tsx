import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'
import {
  getTimeRange,
  getMonthTimeRange,
  buildWeeklyChartData,
  buildMonthlyChartData,
  calcAvgCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
} from '@/features/analytics/utils/analytics.utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month'

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEK_RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
]

const MONTH_RANGE_OPTIONS = [
  { label: '3 tháng gần nhất', value: '3' },
  { label: '6 tháng gần nhất', value: '6' },
  { label: '12 tháng gần nhất', value: '12' },
]

// Dùng chart-2 (teal) cho kỳ bình thường — consistent với MemberTrendChart
const chartConfig = {
  actual: {
    label: 'Thực tế',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

// ── SummaryStats (inline) ─────────────────────────────────────────────────────

interface SummaryStatsProps {
  chartData: { actual: number; committed: number }[]
  mode: ViewMode
}

function SummaryStats({ chartData, mode }: SummaryStatsProps) {
  const totalActual = chartData.reduce((sum, d) => sum + d.actual, 0)
  // P-1: chia cho tổng số kỳ trong range (không bỏ qua kỳ không làm việc)
  const avgHours = chartData.length > 0
    ? Math.round(totalActual / chartData.length)
    : 0
  const periodsBelow = chartData.filter(d => {
    const rate = d.committed > 0 ? d.actual / d.committed : null
    return rate !== null && rate < 0.7
  }).length
  const totalPeriods = chartData.length
  const unit = mode === 'week' ? 'tuần' : 'tháng'

  return (
    <div className="flex items-center gap-6 pt-1 pb-0.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Tổng giờ</span>
        <span className="text-sm font-semibold">{Math.round(totalActual)}h</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">TB/{unit}</span>
        <span className="text-sm font-semibold">{avgHours}h</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Dưới 70%</span>
        <span className={cn(
          'text-sm font-semibold',
          periodsBelow > 0 ? 'text-destructive' : 'text-foreground',
        )}>
          {periodsBelow}/{totalPeriods} {unit}
        </span>
      </div>
    </div>
  )
}

// ── SelfAnalyticsHistory ───────────────────────────────────────────────────────

export function SelfAnalyticsHistory() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // ── View mode & range state ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)
  const [rangeMonths, setRangeMonths] = useState<number>(3)

  const handleToggleMode = (mode: ViewMode) => {
    setViewMode(mode)
    // Reset range khi đổi mode (AC5)
    if (mode === 'week') setRangeWeeks(4)
    else setRangeMonths(3)
  }

  // ── Date range ────────────────────────────────────────────────────────────
  const { startDate, endDate } = viewMode === 'week'
    ? getTimeRange(rangeWeeks)
    : getMonthTimeRange(rangeMonths)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: isMembersLoading } = useTenantMembers()

  const { data: tenantSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getTenantSettings(activeTenantId)
    },
    enabled: !!activeTenantId,
    staleTime: 5 * 60_000,
  })

  const {
    data: analyticsData,
    isLoading: isHoursLoading,
    isError: isHoursError,
  } = useSelfAnalytics(startDate, endDate)
  const weeklyHours = analyticsData?.weeklyHours ?? []
  const committedHistory = analyticsData?.committedHistory ?? []

  // ── Compute effective committed hours ─────────────────────────────────────
  const myMember = members.find(m => m.user_id === user?.id)
  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40
  const effectiveCommittedHours = myMember?.committed_hours ?? defaultCommittedHours

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = viewMode === 'week'
    ? buildWeeklyChartData(weeklyHours, startDate, endDate, committedHistory, effectiveCommittedHours)
    : buildMonthlyChartData(weeklyHours, startDate, endDate, effectiveCommittedHours)

  // Avg rate — dùng weeklyHours (raw weeks) cho cả 2 mode để consistent
  const avgRate = calcAvgCommitmentRate(weeklyHours, effectiveCommittedHours)
  const avgRateColorClass = getCommitmentRateColorClass(avgRate)

  // Reference line value: cho monthly mode, dùng avg committed/tháng từ chartData
  const avgMonthlyCommitted = viewMode === 'month' && chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.committed, 0) / chartData.length)
    : effectiveCommittedHours
  const referenceLineY = viewMode === 'week' ? effectiveCommittedHours : avgMonthlyCommitted

  const yMax = Math.max(...chartData.map(w => w.actual), referenceLineY)
  const isLoading = isMembersLoading || isSettingsLoading || isHoursLoading

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header: avg rate + toggle + range selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Lịch sử commitment</p>
          <p className="text-xs text-muted-foreground">
            Trung bình:{' '}
            <span className={`font-semibold ${avgRateColorClass}`}>{formatRate(avgRate)}</span>
            {viewMode === 'month' && (
              <span className="font-normal text-muted-foreground"> (theo tuần)</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle tuần/tháng (AC1) */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              className={cn(
                'px-3 py-1.5 transition-colors',
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => handleToggleMode('week')}
            >
              Theo tuần
            </button>
            <button
              className={cn(
                'px-3 py-1.5 transition-colors border-l border-border',
                viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => handleToggleMode('month')}
            >
              Theo tháng
            </button>
          </div>

          {/* Range selector — đổi options theo mode */}
          <Select
            value={viewMode === 'week' ? String(rangeWeeks) : String(rangeMonths)}
            onValueChange={(v) => {
              if (viewMode === 'week') setRangeWeeks(Number(v))
              else setRangeMonths(Number(v))
            }}
          >
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(viewMode === 'week' ? WEEK_RANGE_OPTIONS : MONTH_RANGE_OPTIONS).map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      {isHoursError ? (
        <div className="h-52 flex items-center justify-center text-sm text-destructive">
          Không thể tải dữ liệu. Vui lòng thử lại.
        </div>
      ) : chartData.length === 0 || chartData.every(w => w.actual === 0) ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Không có dữ liệu báo cáo trong khoảng thời gian này.</span>
          {effectiveCommittedHours > 0 && viewMode === 'week' && (
            <span className="text-xs">Mục tiêu: {effectiveCommittedHours}h/tuần</span>
          )}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 32, left: -16, bottom: 0 }}
            barCategoryGap="35%"
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={viewMode === 'week' ? 'weekLabel' : 'monthLabel'}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}h`}
              domain={[0, Math.ceil(yMax * 1.15)]}
            />
            <ChartTooltip
              cursor={{ fill: 'color-mix(in oklch, var(--muted) 40%, transparent)' }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === 'actual') return [`${value}h`, 'Thực tế']
                    return [`${value}h`, String(name)]
                  }}
                  labelFormatter={(label) =>
                    viewMode === 'week' ? `Tuần ${label}` : `Tháng ${label}`
                  }
                />
              }
            />
            <ReferenceLine
              y={referenceLineY}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `${referenceLineY}h`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, index) => {
                const rate = entry.committed > 0 ? entry.actual / entry.committed : null
                const fill =
                  rate !== null && rate < 0.7
                    ? 'var(--destructive)'
                    : 'var(--color-actual)'
                return (
                  <Cell
                    key={`${viewMode}-${index}`}
                    fill={fill}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}

      {/* Summary card (AC4) — chỉ render khi có data thực tế */}
      {chartData.length > 0 && !isHoursError && !chartData.every(d => d.actual === 0) && (
        <SummaryStats chartData={chartData} mode={viewMode} />
      )}

      {/* Footer legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)]" />
          Thực tế
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" />
          Dưới 70% cam kết
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 border-t-2 border-dashed border-muted-foreground" />
          Cam kết ({referenceLineY}h/{viewMode === 'week' ? 'tuần' : 'tháng'})
        </span>
      </div>
    </div>
  )
}
