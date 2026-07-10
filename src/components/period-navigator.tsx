import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  type Granularity,
  type Period,
  shiftPeriod,
  formatPeriodLabel,
  isCurrentOrFuturePeriod,
} from '@/lib/period'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
  year: 'Năm',
}

const ALL_GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'year']

// ── PeriodNavigator ─────────────────────────────────────────────────────────────

interface PeriodNavigatorProps {
  period: Period
  onChange: (next: Period) => void
  /** Giới hạn mức gom hiển thị (mặc định cả 4). VD /usage chỉ ['day','week','month']. */
  granularities?: Granularity[]
}

/**
 * PeriodNavigator — bộ chọn mức gom + điều hướng lùi/tiến kỳ.
 * Nút "tiến" bị disable khi đang ở kỳ hiện tại/tương lai (không cho vượt hiện tại).
 * Đổi granularity → reset anchor về hôm nay để tránh anchor lệch giữa các mức.
 */
export function PeriodNavigator({
  period,
  onChange,
  granularities = ALL_GRANULARITIES,
}: PeriodNavigatorProps) {
  const atLatest = isCurrentOrFuturePeriod(period)

  return (
    <div className="flex items-center gap-2">
      <Select
        value={period.granularity}
        onValueChange={(v) =>
          onChange({ granularity: v as Granularity, anchor: format(new Date(), 'yyyy-MM-dd') })
        }
      >
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {granularities.map((g) => (
            <SelectItem key={g} value={g} className="text-xs">
              {GRANULARITY_LABELS[g]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Kỳ trước"
          onClick={() => onChange(shiftPeriod(period, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-36 text-center text-xs text-muted-foreground tabular-nums">
          {formatPeriodLabel(period)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Kỳ sau"
          disabled={atLatest}
          onClick={() => onChange(shiftPeriod(period, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
