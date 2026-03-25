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
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'
import {
  getTimeRange,
  buildWeeklyChartData,
  calcAvgCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
} from '@/features/analytics/utils/analytics.utils'

const RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
]

// Dùng chart-2 (teal) cho tuần bình thường — consistent với MemberTrendChart
// Tuần < 70%: destructive (đỏ)
const chartConfig = {
  actual: {
    label: 'Thực tế',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function SelfAnalyticsHistory() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)

  const { startDate, endDate } = getTimeRange(rangeWeeks)

  // ── Queries ────────────────────────────────────────────────────────────────

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
    data: weeklyHours = [],
    isLoading: isHoursLoading,
    isError: isHoursError,
  } = useSelfAnalytics(startDate, endDate)

  // ── Compute effective committed hours ─────────────────────────────────────

  const myMember = members.find(m => m.user_id === user?.id)
  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40
  const effectiveCommittedHours = myMember?.committed_hours ?? defaultCommittedHours

  // ── Chart data ─────────────────────────────────────────────────────────────

  const chartData = buildWeeklyChartData(weeklyHours, startDate, endDate, effectiveCommittedHours)
  const avgRate = calcAvgCommitmentRate(weeklyHours, effectiveCommittedHours)
  const avgRateColorClass = getCommitmentRateColorClass(avgRate)

  const yMax = Math.max(...chartData.map(w => w.actual), effectiveCommittedHours)

  const isLoading = isMembersLoading || isSettingsLoading || isHoursLoading

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header + Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Lịch sử commitment</p>
          <p className="text-xs text-muted-foreground">
            Trung bình:{' '}
            <span className={`font-semibold ${avgRateColorClass}`}>{formatRate(avgRate)}</span>
          </p>
        </div>
        <Select
          value={String(rangeWeeks)}
          onValueChange={(v) => setRangeWeeks(Number(v))}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      {isHoursError ? (
        <div className="h-52 flex items-center justify-center text-sm text-destructive">
          Không thể tải dữ liệu. Vui lòng thử lại.
        </div>
      ) : chartData.length === 0 || chartData.every(w => w.actual === 0) ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Không có dữ liệu báo cáo trong khoảng thời gian này.</span>
          {effectiveCommittedHours > 0 && (
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
              dataKey="weekLabel"
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
                  labelFormatter={(label) => `Tuần ${label}`}
                />
              }
            />
            {/* Committed target line — dashed, consistent với MemberTrendChart */}
            <ReferenceLine
              y={effectiveCommittedHours}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `${effectiveCommittedHours}h`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            {/* Per-bar color: đỏ khi rate < 70% (AC3), teal bình thường */}
            <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {chartData.map((entry) => {
                const rate =
                  entry.committed > 0 ? entry.actual / entry.committed : null
                const fill =
                  rate !== null && rate < 0.7
                    ? 'var(--destructive)'
                    : 'var(--color-actual)'
                return <Cell key={entry.weekLabel} fill={fill} />
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}

      {/* Footer legend — consistent với MemberTrendChart */}
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
          Cam kết ({effectiveCommittedHours}h/tuần)
        </span>
      </div>
    </div>
  )
}
