import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  calcAvgCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
} from '@/features/analytics/utils/analytics.utils'
import type { WeeklyHoursRow } from '@/features/analytics/services/analytics.service'

// ── Chart config ───────────────────────────────────────────────────────────────

const chartConfig = {
  actual: {
    label: 'Thực tế',
    color: 'var(--chart-2)',  // oklch teal — contrast tốt với reference line
  },
} satisfies ChartConfig

// ── MemberTrendChart ───────────────────────────────────────────────────────────

interface MemberTrendChartProps {
  memberName: string
  chartData: { weekLabel: string; actual: number; committed: number }[]
  weeklyHours: WeeklyHoursRow[]
  committedHoursPerWeek: number
  isLoading: boolean
}

export function MemberTrendChart({
  memberName,
  chartData,
  weeklyHours,
  committedHoursPerWeek,
  isLoading,
}: MemberTrendChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  const avgRate = calcAvgCommitmentRate(weeklyHours, committedHoursPerWeek)
  const avgRateColorClass = getCommitmentRateColorClass(avgRate)

  // YAxis upper bound: đảm bảo reference line luôn hiển thị đủ
  const yMax = Math.max(
    ...chartData.map(w => w.actual),
    committedHoursPerWeek,
  )

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      {/* Header: member name + avg rate */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate">{memberName}</p>
        <p className="text-sm text-muted-foreground shrink-0 ml-4">
          Avg:{' '}
          <span className={`font-semibold ${avgRateColorClass}`}>
            {formatRate(avgRate)}
          </span>
        </p>
      </div>

      {/* Empty state — dùng chartData làm single source of truth */}
      {chartData.length === 0 || chartData.every(w => w.actual === 0) ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Không có dữ liệu báo cáo trong khoảng thời gian này.</span>
          {committedHoursPerWeek > 0 && (
            <span className="text-xs">
              Mục tiêu: {committedHoursPerWeek}h/tuần
            </span>
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
            {/* Committed target line — hiển thị rõ mục tiêu */}
            <ReferenceLine
              y={committedHoursPerWeek}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `${committedHoursPerWeek}h`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <Bar
              dataKey="actual"
              fill="var(--color-actual)"
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ChartContainer>
      )}

      {/* Footer legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
          Thực tế
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 border-t-2 border-dashed border-muted-foreground" />
          Cam kết ({committedHoursPerWeek}h/tuần)
        </span>
      </div>
    </div>
  )
}
