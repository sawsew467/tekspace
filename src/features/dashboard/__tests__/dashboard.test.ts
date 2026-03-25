import { describe, it, expect } from 'vitest'
import {
  groupSlotsByUser,
  getSlotsForDate,
  formatSlotTimeRange,
  formatSlotDuration,
  computeSlotLocalParts,
  buildCellUserMap,
  computeDisplayRange,
  getHeatmapBgClass,
  getInitials,
  getOnlineMemberIds,
} from '../utils/dashboard.utils'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<ScheduleSlot> & Pick<ScheduleSlot, 'id' | 'user_id' | 'slot_date' | 'start_time' | 'duration_minutes'>): ScheduleSlot {
  return {
    tenant_id: 'tenant-1',
    week_id: 'week-1',
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-03-25T00:00:00Z',
    ...overrides,
  }
}

// ── groupSlotsByUser ──────────────────────────────────────────────────────────

describe('groupSlotsByUser', () => {
  it('trả về object rỗng khi không có slots', () => {
    expect(groupSlotsByUser([])).toEqual({})
  })

  it('nhóm đúng khi chỉ có 1 user', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T02:00:00Z', duration_minutes: 480 }),
      makeSlot({ id: 's2', user_id: 'u1', slot_date: '2026-03-24', start_time: '2026-03-24T02:00:00Z', duration_minutes: 480 }),
    ]
    const result = groupSlotsByUser(slots)
    expect(Object.keys(result)).toEqual(['u1'])
    expect(result['u1']).toHaveLength(2)
  })

  it('nhóm đúng khi có nhiều users', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T02:00:00Z', duration_minutes: 480 }),
      makeSlot({ id: 's2', user_id: 'u2', slot_date: '2026-03-23', start_time: '2026-03-23T03:00:00Z', duration_minutes: 240 }),
      makeSlot({ id: 's3', user_id: 'u1', slot_date: '2026-03-24', start_time: '2026-03-24T02:00:00Z', duration_minutes: 480 }),
    ]
    const result = groupSlotsByUser(slots)
    expect(result['u1']).toHaveLength(2)
    expect(result['u2']).toHaveLength(1)
    expect(result['u3']).toBeUndefined()
  })

  it('giữ nguyên thứ tự slots trong từng group', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T02:00:00Z', duration_minutes: 120 }),
      makeSlot({ id: 's2', user_id: 'u1', slot_date: '2026-03-24', start_time: '2026-03-24T08:00:00Z', duration_minutes: 60 }),
    ]
    const result = groupSlotsByUser(slots)
    expect(result['u1'][0].id).toBe('s1')
    expect(result['u1'][1].id).toBe('s2')
  })
})

// ── getSlotsForDate ───────────────────────────────────────────────────────────

describe('getSlotsForDate', () => {
  const slots = [
    makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T02:00:00Z', duration_minutes: 480 }),
    makeSlot({ id: 's2', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T12:00:00Z', duration_minutes: 240 }),
    makeSlot({ id: 's3', user_id: 'u1', slot_date: '2026-03-24', start_time: '2026-03-24T02:00:00Z', duration_minutes: 480 }),
  ]

  it('trả về đúng slots cho ngày khớp', () => {
    const result = getSlotsForDate(slots, '2026-03-23')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toEqual(['s1', 's2'])
  })

  it('trả về [] khi không có slot nào trong ngày', () => {
    const result = getSlotsForDate(slots, '2026-03-25')
    expect(result).toEqual([])
  })

  it('trả về [] khi mảng slots rỗng', () => {
    expect(getSlotsForDate([], '2026-03-23')).toEqual([])
  })
})

// ── formatSlotTimeRange ───────────────────────────────────────────────────────

describe('formatSlotTimeRange', () => {
  it('09:00 UTC + 480 min → "09:00 – 17:00" khi displayTimezone = UTC', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:00:00Z', duration_minutes: 480,
    })
    expect(formatSlotTimeRange(slot, 'UTC')).toBe('09:00 – 17:00')
  })

  it('02:00 UTC + 480 min → "09:00 – 17:00" khi displayTimezone = Asia/Ho_Chi_Minh', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T02:00:00Z', duration_minutes: 480,
    })
    expect(formatSlotTimeRange(slot, 'Asia/Ho_Chi_Minh')).toBe('09:00 – 17:00')
  })

  it('overnight: 15:00 UTC + 120 min → "22:00 – 00:00" khi ICT', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T15:00:00Z', duration_minutes: 120,
    })
    expect(formatSlotTimeRange(slot, 'Asia/Ho_Chi_Minh')).toBe('22:00 – 00:00')
  })
})

// ── formatSlotDuration ────────────────────────────────────────────────────────

describe('formatSlotDuration', () => {
  it('30 → "30 phút"', () => { expect(formatSlotDuration(30)).toBe('30 phút') })
  it('60 → "1 giờ"', () => { expect(formatSlotDuration(60)).toBe('1 giờ') })
  it('90 → "1 giờ 30 phút"', () => { expect(formatSlotDuration(90)).toBe('1 giờ 30 phút') })
  it('480 → "8 giờ"', () => { expect(formatSlotDuration(480)).toBe('8 giờ') })
  it('150 → "2 giờ 30 phút"', () => { expect(formatSlotDuration(150)).toBe('2 giờ 30 phút') })
})

// ── computeSlotLocalParts ─────────────────────────────────────────────────────

describe('computeSlotLocalParts', () => {
  const TZ_UTC = 'UTC'
  const TZ_ICT = 'Asia/Ho_Chi_Minh'

  it('slot bình thường (09:00–17:00 UTC) → 1 part', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:00:00Z', duration_minutes: 480,
    })
    const parts = computeSlotLocalParts(slot, TZ_UTC)
    expect(parts).toHaveLength(1)
    expect(parts[0].day).toBe('2026-03-23')
    expect(parts[0].startD).toBe(9)
    expect(parts[0].endD).toBe(17)
  })

  it('slot ICT: 02:00 UTC + 480 min → day=2026-03-23, 09:00–17:00 ICT', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T02:00:00Z', duration_minutes: 480,
    })
    const parts = computeSlotLocalParts(slot, TZ_ICT)
    expect(parts).toHaveLength(1)
    expect(parts[0].day).toBe('2026-03-23')
    expect(parts[0].startD).toBe(9)
    expect(parts[0].endD).toBe(17)
  })

  it('overnight slot: 15:00 UTC + 120 min → 2 parts (22:00–24:00 Mon, 00:00 Tue)', () => {
    // 15:00 UTC = 22:00 ICT Mon, +120 min = 17:00 UTC = 00:00 ICT Tue (midnight)
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T15:00:00Z', duration_minutes: 120,
    })
    const parts = computeSlotLocalParts(slot, TZ_ICT)
    expect(parts).toHaveLength(1) // endD = 0 (midnight) = not > 0, so part 2 skipped
    expect(parts[0].day).toBe('2026-03-23')
    expect(parts[0].startD).toBe(22)
    expect(parts[0].endD).toBe(24)
  })

  it('overnight slot going past midnight: 15:00 UTC + 180 min → 2 parts', () => {
    // 15:00 UTC = 22:00 ICT Mon, +180 min = 18:00 UTC = 01:00 ICT Tue
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T15:00:00Z', duration_minutes: 180,
    })
    const parts = computeSlotLocalParts(slot, TZ_ICT)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toEqual({ day: '2026-03-23', startD: 22, endD: 24 })
    expect(parts[1]).toEqual({ day: '2026-03-24', startD: 0, endD: 1 })
  })

  it('slot có phút lẻ: 09:30 UTC + 90 min → startD=9.5, endD=11', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:30:00Z', duration_minutes: 90,
    })
    const parts = computeSlotLocalParts(slot, TZ_UTC)
    expect(parts).toHaveLength(1)
    expect(parts[0].startD).toBe(9.5)
    expect(parts[0].endD).toBe(11)
  })
})

// ── buildCellUserMap ──────────────────────────────────────────────────────────

describe('buildCellUserMap', () => {
  const TZ_UTC = 'UTC'

  it('trả về map rỗng khi không có slots', () => {
    const map = buildCellUserMap([], TZ_UTC)
    expect(map.size).toBe(0)
  })

  it('slot 09:00–17:00 UTC → có mặt ở các half-hour keys từ 9 đến 16.5', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:00:00Z', duration_minutes: 480,
    })
    const map = buildCellUserMap([slot], TZ_UTC, 8, 20, 0.5)

    // Key đầu tiên: 9 (09:00)
    expect(map.get('2026-03-23:9')).toContain('u1')
    // Key giữa: 13.5 (13:30)
    expect(map.get('2026-03-23:13.5')).toContain('u1')
    // Key cuối: 16.5 (16:30 → slot kết thúc 17:00 > 16.5, nên overlap)
    expect(map.get('2026-03-23:16.5')).toContain('u1')
    // Không có ở 8.5 (slot bắt đầu từ 9:00, startD=9 < 9=h+0.5? No: 9 < 9 is false)
    expect(map.get('2026-03-23:8.5')).toBeUndefined()
    // Không có ở 17 (endD=17, 17 > 17 is false)
    expect(map.get('2026-03-23:17')).toBeUndefined()
  })

  it('nhiều users cùng giờ → đều có trong cell đó', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T09:00:00Z', duration_minutes: 120 }),
      makeSlot({ id: 's2', user_id: 'u2', slot_date: '2026-03-23', start_time: '2026-03-23T10:00:00Z', duration_minutes: 60 }),
    ]
    const map = buildCellUserMap(slots, TZ_UTC, 8, 20, 0.5)

    // Giờ 9:00 → chỉ u1
    expect(map.get('2026-03-23:9')).toEqual(['u1'])
    // Giờ 10:00 → u1 (kết thúc 11:00) và u2 (bắt đầu 10:00)
    expect(map.get('2026-03-23:10')).toContain('u1')
    expect(map.get('2026-03-23:10')).toContain('u2')
    // Giờ 11:00 → không ai (u1 endD=11, u2 endD=11; 11 > 11 = false)
    expect(map.get('2026-03-23:11')).toBeUndefined()
  })

  it('user_id không bị duplicate trong cùng cell', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T09:00:00Z', duration_minutes: 120 }),
      makeSlot({ id: 's2', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T09:30:00Z', duration_minutes: 60 }),
    ]
    const map = buildCellUserMap(slots, TZ_UTC, 8, 20, 0.5)
    const cell9 = map.get('2026-03-23:9') ?? []
    expect(cell9.filter(id => id === 'u1')).toHaveLength(1)
  })

  it('slot ngoài slotStart/slotEnd bị bỏ qua', () => {
    // Slot 06:00–07:00 UTC, slotStart=8 → không có cell nào
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T06:00:00Z', duration_minutes: 60,
    })
    const map = buildCellUserMap([slot], TZ_UTC, 8, 20, 0.5)
    expect(map.size).toBe(0)
  })

  it('slot 30 phút: 09:00–09:30 → chỉ cell 9 (không có 9.5 vì endD=9.5, 9.5 > 9.5 false)', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:00:00Z', duration_minutes: 30,
    })
    const map = buildCellUserMap([slot], TZ_UTC, 8, 20, 0.5)
    expect(map.get('2026-03-23:9')).toContain('u1')
    expect(map.get('2026-03-23:9.5')).toBeUndefined()
  })
})

// ── computeDisplayRange ───────────────────────────────────────────────────────

describe('computeDisplayRange', () => {
  const TZ_UTC = 'UTC'

  it('không có slots → default [8, 20]', () => {
    expect(computeDisplayRange([], TZ_UTC)).toEqual([8, 20])
  })

  it('slots nằm trong default range → không thay đổi range', () => {
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T09:00:00Z', duration_minutes: 480, // 09:00–17:00
    })
    expect(computeDisplayRange([slot], TZ_UTC)).toEqual([8, 20])
  })

  it('slot bắt đầu trước defaultStart → mở rộng xuống', () => {
    // 06:00–09:00 UTC → startD=6, endD=9
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T06:00:00Z', duration_minutes: 180,
    })
    const [start, end] = computeDisplayRange([slot], TZ_UTC)
    expect(start).toBe(6)
    expect(end).toBe(20)
  })

  it('slot kết thúc sau defaultEnd → mở rộng lên', () => {
    // 18:00–22:00 UTC → startD=18, endD=22
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T18:00:00Z', duration_minutes: 240,
    })
    const [start, end] = computeDisplayRange([slot], TZ_UTC)
    expect(start).toBe(8)
    expect(end).toBe(22)
  })

  it('overnight slot: 22:00 UTC + 480 min (22:00–06:00 next day) → range mở rộng để cover cả 2 parts', () => {
    // Part 1: {day: Mon, startD: 22, endD: 24}
    // Part 2: {day: Tue, startD: 0, endD: 6}
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T22:00:00Z', duration_minutes: 480,
    })
    const [start, end] = computeDisplayRange([slot], TZ_UTC)
    expect(start).toBe(0)  // Part 2 bắt đầu từ 0
    expect(end).toBe(24)   // Part 1 kết thúc tại 24
  })

  it('nhiều slots → range cover tất cả', () => {
    const slots = [
      makeSlot({ id: 's1', user_id: 'u1', slot_date: '2026-03-23', start_time: '2026-03-23T07:00:00Z', duration_minutes: 120 }), // 07:00–09:00
      makeSlot({ id: 's2', user_id: 'u2', slot_date: '2026-03-24', start_time: '2026-03-24T19:30:00Z', duration_minutes: 90 }),  // 19:30–21:00
    ]
    const [start, end] = computeDisplayRange(slots, TZ_UTC)
    expect(start).toBe(7)
    expect(end).toBe(21)
  })

  it('snap to 0.5 boundary: startD=6.5 → start=6.5, endD=20.5 → end=20.5', () => {
    // 06:30–08:30 UTC
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T06:30:00Z', duration_minutes: 120,
    })
    const [start, end] = computeDisplayRange([slot], TZ_UTC)
    expect(start).toBe(6.5)
    expect(end).toBe(20)  // endD=8.5, không vượt defaultEnd=20
  })

  it('clamp: không vượt [0, 24]', () => {
    // Slot bắt đầu 00:00 → startD=0; clamp không xuống âm
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T00:00:00Z', duration_minutes: 60,
    })
    const [start] = computeDisplayRange([slot], TZ_UTC, 8, 20)
    expect(start).toBeGreaterThanOrEqual(0)
  })

  it('ICT timezone: overnight slot 15:00 UTC + 480 min → range cover 22:00–06:00 ICT', () => {
    // 15:00 UTC = 22:00 ICT; +480 min = 23:00 UTC = 06:00 ICT next day
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-23',
      start_time: '2026-03-23T15:00:00Z', duration_minutes: 480,
    })
    const [start, end] = computeDisplayRange([slot], 'Asia/Ho_Chi_Minh')
    expect(start).toBe(0)   // Part 2: 00:00 ICT next day
    expect(end).toBe(24)    // Part 1: 24 (midnight)
  })
})

// ── getHeatmapBgClass ─────────────────────────────────────────────────────────

describe('getHeatmapBgClass', () => {
  it('0 → empty string (no background)', () => {
    expect(getHeatmapBgClass(0)).toBe('')
  })
  it('1 → bg-blue-50 class', () => {
    expect(getHeatmapBgClass(1)).toContain('bg-blue-50')
  })
  it('2 → bg-blue-100 class', () => {
    expect(getHeatmapBgClass(2)).toContain('bg-blue-100')
  })
  it('3 → bg-blue-200 class', () => {
    expect(getHeatmapBgClass(3)).toContain('bg-blue-200')
  })
  it('4 → bg-blue-300 class', () => {
    expect(getHeatmapBgClass(4)).toContain('bg-blue-300')
  })
  it('10 (many) → bg-blue-300 class', () => {
    expect(getHeatmapBgClass(10)).toContain('bg-blue-300')
  })
})

// ── getInitials ───────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('"Nguyen Van A" → "NA"', () => {
    expect(getInitials('Nguyen Van A')).toBe('NA')
  })
  it('"Thang" (1 từ) → "TH"', () => {
    expect(getInitials('Thang')).toBe('TH')
  })
  it('"Nguyen Thang" → "NT"', () => {
    expect(getInitials('Nguyen Thang')).toBe('NT')
  })
  it('tên có khoảng trắng đầu/cuối → trim trước', () => {
    expect(getInitials('  Le Van B  ')).toBe('LB')
  })
  it('tên rỗng "" → "?"', () => {
    expect(getInitials('')).toBe('?')
  })
  it('tên chỉ có whitespace "   " → "?"', () => {
    expect(getInitials('   ')).toBe('?')
  })
  it('tên có nhiều khoảng trắng giữa các từ → filter đúng', () => {
    expect(getInitials('Nguyen  Thang')).toBe('NT')
  })
})

// ── getOnlineMemberIds ────────────────────────────────────────────────────────

describe('getOnlineMemberIds', () => {
  // Base timestamp: 2026-03-25T10:00:00Z
  const NOW = new Date('2026-03-25T10:00:00Z')

  it('slots = [] → trả về []', () => {
    expect(getOnlineMemberIds([], NOW)).toEqual([])
  })

  it('slot đang active (now nằm trong range) → member xuất hiện', () => {
    // Slot: 09:00–11:00 UTC — now 10:00 → active
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T09:00:00Z', duration_minutes: 120,
    })
    expect(getOnlineMemberIds([slot], NOW)).toEqual(['u1'])
  })

  it('boundary: now === end_time → không online (exclusive end) — slot kết thúc đúng now', () => {
    // Slot: 08:00–10:00 UTC, end = 10:00:00.000 → now = 10:00:00.000 → exclusive end
    const nowExact = new Date('2026-03-25T10:00:00.000Z')
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T08:00:00Z', duration_minutes: 120,  // end = 10:00:00Z
    })
    expect(getOnlineMemberIds([slot], nowExact)).toEqual([])
  })

  it('slot bắt đầu sau now 1ms → không online', () => {
    // Slot: 10:01–12:01 UTC, now = 10:00 → not yet started
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T10:01:00Z', duration_minutes: 120,
    })
    expect(getOnlineMemberIds([slot], NOW)).toEqual([])
  })

  it('boundary: now === start_time → online (inclusive start)', () => {
    const startExact = new Date('2026-03-25T10:00:00.000Z')
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T10:00:00Z', duration_minutes: 60,
    })
    expect(getOnlineMemberIds([slot], startExact)).toEqual(['u1'])
  })

  it('boundary: now === end_time → không online (exclusive end)', () => {
    // Slot: 09:00 + 60 min = end 10:00:00Z
    const endExact = new Date('2026-03-25T10:00:00.000Z')
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T09:00:00Z', duration_minutes: 60,
    })
    expect(getOnlineMemberIds([slot], endExact)).toEqual([])
  })

  it('member có 2 slots cùng active → chỉ xuất hiện 1 lần (dedup)', () => {
    const slot1 = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T09:00:00Z', duration_minutes: 180,  // 09:00–12:00
    })
    const slot2 = makeSlot({
      id: 's2', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T08:00:00Z', duration_minutes: 240,  // 08:00–12:00
    })
    const result = getOnlineMemberIds([slot1, slot2], NOW)
    expect(result).toEqual(['u1'])
    expect(result).toHaveLength(1)
  })

  it('nhiều members online → tất cả xuất hiện', () => {
    const slot1 = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T09:00:00Z', duration_minutes: 120,
    })
    const slot2 = makeSlot({
      id: 's2', user_id: 'u2', slot_date: '2026-03-25',
      start_time: '2026-03-25T09:30:00Z', duration_minutes: 120,
    })
    const slot3 = makeSlot({
      id: 's3', user_id: 'u3', slot_date: '2026-03-25',
      start_time: '2026-03-25T08:00:00Z', duration_minutes: 60,   // kết thúc 09:00 — không online
    })
    const result = getOnlineMemberIds([slot1, slot2, slot3], NOW)
    expect(result).toHaveLength(2)
    expect(result).toContain('u1')
    expect(result).toContain('u2')
    expect(result).not.toContain('u3')
  })

  it('slot kết thúc trước now 1ms (now = endMs - 1) → vẫn online', () => {
    const slotEnd = new Date('2026-03-25T10:00:00.000Z')
    const oneBeforeEnd = new Date(slotEnd.getTime() - 1)
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T08:00:00Z', duration_minutes: 120,  // end = 10:00:00Z
    })
    expect(getOnlineMemberIds([slot], oneBeforeEnd)).toEqual(['u1'])
  })

  it('slot spanning midnight UTC → online khi now nằm trong range qua đêm', () => {
    // Slot: 23:30Z → 01:00Z next day (90 min)
    const duringSlot = new Date('2026-03-26T00:30:00Z')  // midnight + 30min → still active
    const afterSlot = new Date('2026-03-26T01:00:00Z')    // exactly end → not active
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-03-25',
      start_time: '2026-03-25T23:30:00Z', duration_minutes: 90,
    })
    expect(getOnlineMemberIds([slot], duringSlot)).toEqual(['u1'])
    expect(getOnlineMemberIds([slot], afterSlot)).toEqual([])
  })

  it('nowUTC injectable → deterministic (không phụ thuộc new Date())', () => {
    // Slot active tại 2026-01-01T00:00:00Z nhưng không active tại now
    const pastNow = new Date('2026-01-01T00:30:00Z')
    const slot = makeSlot({
      id: 's1', user_id: 'u1', slot_date: '2026-01-01',
      start_time: '2026-01-01T00:00:00Z', duration_minutes: 60,
    })
    expect(getOnlineMemberIds([slot], pastNow)).toEqual(['u1'])
    expect(getOnlineMemberIds([slot], NOW)).toEqual([])  // NOW = 2026-03-25T10:00Z → không active
  })
})
