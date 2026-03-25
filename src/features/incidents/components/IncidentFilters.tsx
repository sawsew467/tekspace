import { INCIDENT_CATEGORY_LABELS } from '@/features/incidents/schemas/incident.schema'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface IncidentFiltersProps {
  members:                    TenantMemberWithUser[]
  filterMemberId:             string
  filterCategory:             string
  filterDateFrom:             string
  filterDateTo:               string
  filterAppealStatus:         string
  onFilterMemberChange:       (value: string) => void
  onFilterCategoryChange:     (value: string) => void
  onFilterDateFromChange:     (value: string) => void
  onFilterDateToChange:       (value: string) => void
  onFilterAppealStatusChange: (value: string) => void
  onReset:                    () => void
}

const APPEAL_STATUS_OPTIONS = [
  { value: 'appealed',     label: 'Đã appeal' },
  { value: 'not_appealed', label: 'Chưa appeal' },
]

export function IncidentFilters({
  members,
  filterMemberId,
  filterCategory,
  filterDateFrom,
  filterDateTo,
  filterAppealStatus,
  onFilterMemberChange,
  onFilterCategoryChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onFilterAppealStatusChange,
  onReset,
}: IncidentFiltersProps) {
  const hasActiveFilter =
    filterMemberId || filterCategory || filterDateFrom || filterDateTo || filterAppealStatus

  // Cảnh báo khi date range bị đảo ngược
  const dateRangeInvalid =
    !!filterDateFrom && !!filterDateTo && filterDateFrom > filterDateTo

  return (
    <div className='space-y-1'>
      <div className='flex flex-wrap gap-2 items-center'>
      {/* Filter: Thành viên */}
      <Select value={filterMemberId || '__all__'} onValueChange={(v) => onFilterMemberChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className='h-8 w-44 text-xs'>
          <SelectValue placeholder='Tất cả thành viên' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='__all__'>Tất cả thành viên</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.users.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter: Loại incident */}
      <Select value={filterCategory || '__all__'} onValueChange={(v) => onFilterCategoryChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className='h-8 w-44 text-xs'>
          <SelectValue placeholder='Tất cả loại' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='__all__'>Tất cả loại</SelectItem>
          {(Object.entries(INCIDENT_CATEGORY_LABELS) as [string, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter: Từ ngày */}
      <Input
        type='date'
        className='h-8 w-36 text-xs'
        value={filterDateFrom}
        onChange={(e) => onFilterDateFromChange(e.target.value)}
        placeholder='Từ ngày'
      />

      {/* Filter: Đến ngày */}
      <Input
        type='date'
        className='h-8 w-36 text-xs'
        value={filterDateTo}
        onChange={(e) => onFilterDateToChange(e.target.value)}
        placeholder='Đến ngày'
      />

      {/* Filter: Appeal status */}
      <Select value={filterAppealStatus || '__all__'} onValueChange={(v) => onFilterAppealStatusChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className='h-8 w-36 text-xs'>
          <SelectValue placeholder='Tất cả' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='__all__'>Tất cả</SelectItem>
          {APPEAL_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Xóa filter — chỉ hiển thị khi có ít nhất 1 filter active */}
      {hasActiveFilter && (
        <Button variant='ghost' size='sm' className='h-8 text-xs' onClick={onReset}>
          Xóa filter
        </Button>
      )}
    </div>

    {/* Cảnh báo date range bị đảo ngược */}
    {dateRangeInvalid && (
      <p className='text-xs text-destructive ml-0.5'>
        Ngày bắt đầu phải trước ngày kết thúc.
      </p>
    )}
  </div>
  )
}
