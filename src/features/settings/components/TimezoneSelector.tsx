import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COMMON_TIMEZONES } from '@/lib/timezones'

type TimezoneSelectorProps = {
  value: string
  onChange: (tz: string) => void
  disabled?: boolean
}

export function TimezoneSelector({ value, onChange, disabled }: TimezoneSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder='Chọn timezone' />
      </SelectTrigger>
      <SelectContent>
        {COMMON_TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            {tz.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
