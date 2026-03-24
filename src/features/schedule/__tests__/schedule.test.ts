import { describe, it, expect } from 'vitest'
import { slotFormSchema, calcDurationMinutes, formatDuration } from '../schemas/schedule.schema'
import { hasOverlapWithExisting } from '../utils/schedule.utils'
import type { ScheduleSlot } from '../services/schedule.service'

// ── slotFormSchema tests ─────────────────────────────────────────────────────

describe('slotFormSchema', () => {
  it('valid slot (09:00–17:00, 8h) passes', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects duration < 30 min (09:00–09:00 same time)', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '09:00',
      endTime: '09:00',
      isOvernight: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects duration > 720 min (00:00–12:30 = 750 min)', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '00:00',
      endTime: '12:30',
      isOvernight: false,
    })
    expect(result.success).toBe(false)
  })

  it('valid overnight slot (22:00–02:00 = 240 min) passes', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '22:00',
      endTime: '02:00',
      isOvernight: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-30min startTime (09:15)', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '09:15',
      endTime: '10:00',
      isOvernight: false,
    })
    expect(result.success).toBe(false)
  })

  it('accepts minimum valid slot (09:00–09:30 = 30 min)', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '09:00',
      endTime: '09:30',
      isOvernight: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts maximum valid slot (00:00–12:00 = 720 min)', () => {
    const result = slotFormSchema.safeParse({
      slotDate: '2026-03-23',
      startTime: '00:00',
      endTime: '12:00',
      isOvernight: false,
    })
    expect(result.success).toBe(true)
  })
})

// ── calcDurationMinutes tests ────────────────────────────────────────────────

describe('calcDurationMinutes', () => {
  it('09:00–17:00 = 480 min', () => {
    expect(
      calcDurationMinutes({ slotDate: '2026-03-23', startTime: '09:00', endTime: '17:00', isOvernight: false })
    ).toBe(480)
  })

  it('overnight 22:00–02:00 = 240 min', () => {
    expect(
      calcDurationMinutes({ slotDate: '2026-03-23', startTime: '22:00', endTime: '02:00', isOvernight: true })
    ).toBe(240)
  })

  it('auto-detect overnight when end <= start without isOvernight flag', () => {
    // endTime < startTime → treated as overnight
    expect(
      calcDurationMinutes({ slotDate: '2026-03-23', startTime: '23:00', endTime: '01:00', isOvernight: false })
    ).toBe(120)
  })

  it('09:00–09:30 = 30 min (minimum)', () => {
    expect(
      calcDurationMinutes({ slotDate: '2026-03-23', startTime: '09:00', endTime: '09:30', isOvernight: false })
    ).toBe(30)
  })
})

// ── formatDuration tests ─────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('30 → "30 phút"', () => {
    expect(formatDuration(30)).toBe('30 phút')
  })
  it('60 → "1 giờ"', () => {
    expect(formatDuration(60)).toBe('1 giờ')
  })
  it('90 → "1 giờ 30 phút"', () => {
    expect(formatDuration(90)).toBe('1 giờ 30 phút')
  })
  it('480 → "8 giờ"', () => {
    expect(formatDuration(480)).toBe('8 giờ')
  })
  it('720 → "12 giờ"', () => {
    expect(formatDuration(720)).toBe('12 giờ')
  })
})

// ── hasOverlapWithExisting tests ────────────────────────────────────────────

function makeSlot(overrides: Partial<ScheduleSlot> & Pick<ScheduleSlot, 'id' | 'slot_date' | 'start_time' | 'duration_minutes'>): ScheduleSlot {
  return {
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    week_id: 'week-1',
    created_at: '2026-03-23T00:00:00Z',
    updated_at: '2026-03-23T00:00:00Z',
    ...overrides,
  }
}

describe('hasOverlapWithExisting', () => {
  const monday = '2026-03-23'

  // Existing: 09:00–11:00 UTC (UTC for test simplicity)
  const existing09to11 = makeSlot({
    id: 'slot-1',
    slot_date: monday,
    start_time: `${monday}T09:00:00Z`,
    duration_minutes: 120,
  })

  it('no overlap — disjoint slots (11:00–13:00 after 09:00–11:00)', () => {
    expect(hasOverlapWithExisting('11:00', '13:00', monday, false, [existing09to11])).toBe(false)
  })

  it('overlap — new slot starts during existing (10:00–12:00)', () => {
    expect(hasOverlapWithExisting('10:00', '12:00', monday, false, [existing09to11])).toBe(true)
  })

  it('overlap — new slot contains existing (08:00–13:00)', () => {
    expect(hasOverlapWithExisting('08:00', '13:00', monday, false, [existing09to11])).toBe(true)
  })

  it('no overlap — adjacent slots (boundary = 09:00)', () => {
    // New slot ends exactly when existing starts: 07:00–09:00
    expect(hasOverlapWithExisting('07:00', '09:00', monday, false, [existing09to11])).toBe(false)
  })

  it('no overlap — different slot_date', () => {
    const tuesday = '2026-03-24'
    const existingTuesday = makeSlot({
      id: 'slot-2',
      slot_date: tuesday,
      start_time: `${tuesday}T09:00:00Z`,
      duration_minutes: 120,
    })
    expect(hasOverlapWithExisting('09:30', '10:30', monday, false, [existingTuesday])).toBe(false)
  })

  it('skips slot with excludeSlotId', () => {
    expect(
      hasOverlapWithExisting('09:00', '11:00', monday, false, [existing09to11], 'slot-1')
    ).toBe(false)
  })

  it('no overlap — empty existing slots', () => {
    expect(hasOverlapWithExisting('09:00', '11:00', monday, false, [])).toBe(false)
  })
})
