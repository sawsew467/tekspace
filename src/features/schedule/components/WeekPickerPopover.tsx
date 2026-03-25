import { useState } from 'react'
import { startOfISOWeek, addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'

interface WeekPickerPopoverProps {
  weekOf: string                        // Monday 'YYYY-MM-DD'
  onWeekChange: (weekOf: string) => void
}

/**
 * WeekPickerPopover — click vào text range tuần để mở Calendar và chọn tuần bất kỳ
 *
 * AC1: Calendar mode="range", highlight Mon–Sun của tuần đang xem.
 * Click vào bất kỳ ngày nào → navigate đến tuần đó (dùng startOfISOWeek).
 */
export function WeekPickerPopover({ weekOf, onWeekChange }: WeekPickerPopoverProps) {
  const [open, setOpen] = useState(false)

  const weekStart = parseISO(weekOf)
  const weekEnd = addDays(weekStart, 6)

  const label = `${format(weekStart, 'dd/MM')} – ${format(weekEnd, 'dd/MM/yyyy')}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-sm text-muted-foreground tabular-nums px-2"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="range"
          selected={{ from: weekStart, to: weekEnd }}
          locale={vi}
          onDayClick={(day) => {
            const newWeekOf = format(startOfISOWeek(day), 'yyyy-MM-dd')
            onWeekChange(newWeekOf)
            setOpen(false)
          }}
          today={new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}
