import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import {
  TaskItemSchema,
  ParsedReportSchema,
  AiParseResponseSchema,
  ImportModeSchema,
  ImportResultSchema,
} from '../types/ai-parse.types'

// ── TaskItemSchema (Z1–Z4) ──────────────────────────────────────────────────

describe('TaskItemSchema', () => {
  it('Z1: valid task item passes', () => {
    const result = TaskItemSchema.safeParse({ description: 'Fix bug #123', hours: 3 })
    expect(result.success).toBe(true)
  })

  it('Z2: hours defaults to 0 when omitted', () => {
    const result = TaskItemSchema.safeParse({ description: 'Fix bug #123' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.hours).toBe(0)
  })

  it('Z3: empty description fails', () => {
    const result = TaskItemSchema.safeParse({ description: '', hours: 2 })
    expect(result.success).toBe(false)
  })

  it('Z4: negative hours fails', () => {
    const result = TaskItemSchema.safeParse({ description: 'Task', hours: -1 })
    expect(result.success).toBe(false)
  })
})

// ── ParsedReportSchema (Z5–Z8) ─────────────────────────────────────────────

describe('ParsedReportSchema', () => {
  it('Z5: valid report passes', () => {
    const result = ParsedReportSchema.safeParse({
      author: 'Nguyễn Văn A',
      date: '2026-03-30',
      completed_tasks: [{ description: 'Task 1', hours: 2 }],
      in_progress_tasks: [{ description: 'Task 2', hours: 3 }],
      plan_for_tomorrow: 'Work on feature X',
      blockers: null,
    })
    expect(result.success).toBe(true)
  })

  it('Z6: empty author fails', () => {
    const result = ParsedReportSchema.safeParse({
      author: '',
      date: '2026-03-30',
      completed_tasks: [],
      in_progress_tasks: [],
    })
    expect(result.success).toBe(false)
  })

  it('Z7: invalid date format fails', () => {
    const result = ParsedReportSchema.safeParse({
      author: 'John',
      date: '30/03/2026', // wrong format
      completed_tasks: [],
      in_progress_tasks: [],
    })
    expect(result.success).toBe(false)
  })

  it('Z8: null plan/blockers allowed', () => {
    const result = ParsedReportSchema.safeParse({
      author: 'Jane',
      date: '2026-03-29',
      completed_tasks: [],
      in_progress_tasks: [],
      plan_for_tomorrow: null,
      blockers: null,
    })
    expect(result.success).toBe(true)
  })
})

// ── AiParseResponseSchema (Z9–Z10) ───────────────────────────────────────

describe('AiParseResponseSchema', () => {
  it('Z9: valid response with multiple reports passes', () => {
    const result = AiParseResponseSchema.safeParse({
      reports: [
        {
          author: 'Alice',
          date: '2026-03-30',
          completed_tasks: [{ description: 'A', hours: 1 }],
          in_progress_tasks: [],
        },
        {
          author: 'Bob',
          date: '2026-03-30',
          completed_tasks: [],
          in_progress_tasks: [{ description: 'B', hours: 2 }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('Z10: empty reports array passes', () => {
    const result = AiParseResponseSchema.safeParse({ reports: [] })
    expect(result.success).toBe(true)
  })
})

// ── ImportModeSchema ────────────────────────────────────────────────────────

describe('ImportModeSchema', () => {
  it('accepts "skip"', () => {
    expect(ImportModeSchema.safeParse('skip').success).toBe(true)
  })

  it('accepts "overwrite"', () => {
    expect(ImportModeSchema.safeParse('overwrite').success).toBe(true)
  })

  it('rejects unknown mode', () => {
    expect(ImportModeSchema.safeParse('delete').success).toBe(false)
  })
})

// ── ImportResultSchema ──────────────────────────────────────────────────────

describe('ImportResultSchema', () => {
  it('valid result passes', () => {
    const result = ImportResultSchema.safeParse({
      imported: 5,
      skipped: 2,
      overwritten: 1,
      errors: [
        { rowKey: 'user1|2026-03-30', message: 'Missing user_id' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('errors defaults to empty array', () => {
    const result = ImportResultSchema.safeParse({
      imported: 3,
      skipped: 0,
      overwritten: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.errors).toEqual([])
  })
})
