import { describe, it, expect } from 'vitest'
import {
  dailyReportFormSchema,
  taskItemSchema,
  outputTypeSchema,
  OUTPUT_TYPE_LABELS,
  OUTPUT_TYPE_PLACEHOLDERS,
  hasDiscrepancy,
  type TaskItem,
} from '../schemas/daily-report.schema'

// ── outputTypeSchema ─────────────────────────────────────────────────────────

describe('outputTypeSchema', () => {
  it('accepts pr', () => {
    expect(outputTypeSchema.safeParse('pr').success).toBe(true)
  })
  it('accepts figma', () => {
    expect(outputTypeSchema.safeParse('figma').success).toBe(true)
  })
  it('accepts document', () => {
    expect(outputTypeSchema.safeParse('document').success).toBe(true)
  })
  it('accepts other', () => {
    expect(outputTypeSchema.safeParse('other').success).toBe(true)
  })
  it('rejects unknown type', () => {
    expect(outputTypeSchema.safeParse('unknown').success).toBe(false)
  })
  it('rejects empty string', () => {
    expect(outputTypeSchema.safeParse('').success).toBe(false)
  })
})

// ── taskItemSchema ───────────────────────────────────────────────────────────

describe('taskItemSchema', () => {
  it('valid task without output_link passes', () => {
    const result = taskItemSchema.safeParse({
      description: 'Fix bug #123',
      output_type: 'pr',
      output_link: '',
    })
    expect(result.success).toBe(true)
  })

  it('valid task with valid URL passes', () => {
    const result = taskItemSchema.safeParse({
      description: 'Implement feature',
      output_type: 'pr',
      output_link: 'https://github.com/org/repo/pull/42',
    })
    expect(result.success).toBe(true)
  })

  it('valid task without output_link field passes', () => {
    const result = taskItemSchema.safeParse({
      description: 'Design review',
      output_type: 'figma',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty description', () => {
    const result = taskItemSchema.safeParse({
      description: '',
      output_type: 'other',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Mô tả task không được để trống')
  })

  it('rejects invalid URL in output_link (non-empty)', () => {
    const result = taskItemSchema.safeParse({
      description: 'Some task',
      output_type: 'pr',
      output_link: 'not-a-url',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Link không hợp lệ')
  })

  it('accepts empty string as output_link (optional)', () => {
    const result = taskItemSchema.safeParse({
      description: 'Some task',
      output_type: 'document',
      output_link: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid output_type', () => {
    const result = taskItemSchema.safeParse({
      description: 'Some task',
      output_type: 'video',
    })
    expect(result.success).toBe(false)
  })
})

// ── dailyReportFormSchema ────────────────────────────────────────────────────

describe('dailyReportFormSchema', () => {
  const validForm = {
    tasks: [{ description: 'Fix bug', output_type: 'pr', output_link: '' }],
    hours_logged: 8,
  }

  it('valid form passes', () => {
    expect(dailyReportFormSchema.safeParse(validForm).success).toBe(true)
  })

  it('rejects empty tasks array', () => {
    const result = dailyReportFormSchema.safeParse({ ...validForm, tasks: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Cần ít nhất 1 task')
  })

  it('accepts hours_logged = 0', () => {
    expect(dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 0 }).success).toBe(true)
  })

  it('accepts hours_logged = 24', () => {
    expect(dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 24 }).success).toBe(true)
  })

  it('rejects hours_logged < 0', () => {
    const result = dailyReportFormSchema.safeParse({ ...validForm, hours_logged: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects hours_logged > 24', () => {
    const result = dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 25 })
    expect(result.success).toBe(false)
  })

  it('accepts fractional hours_logged (8.5)', () => {
    expect(dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 8.5 }).success).toBe(true)
  })

  it('accepts multiple tasks', () => {
    const result = dailyReportFormSchema.safeParse({
      tasks: [
        { description: 'Task 1', output_type: 'pr', output_link: 'https://github.com/org/repo/pull/1' },
        { description: 'Task 2', output_type: 'figma', output_link: '' },
        { description: 'Task 3', output_type: 'other' },
      ],
      hours_logged: 6,
    })
    expect(result.success).toBe(true)
  })
})

// ── OUTPUT_TYPE_LABELS / PLACEHOLDERS ────────────────────────────────────────

describe('OUTPUT_TYPE_LABELS', () => {
  it('has all 4 output types', () => {
    expect(Object.keys(OUTPUT_TYPE_LABELS)).toEqual(['pr', 'figma', 'document', 'other'])
  })

  it('pr label contains GitHub/GitLab', () => {
    expect(OUTPUT_TYPE_LABELS.pr).toContain('GitHub')
  })
})

describe('OUTPUT_TYPE_PLACEHOLDERS', () => {
  it('has all 4 output types', () => {
    expect(Object.keys(OUTPUT_TYPE_PLACEHOLDERS)).toEqual(['pr', 'figma', 'document', 'other'])
  })

  it('pr placeholder is a GitHub URL', () => {
    expect(OUTPUT_TYPE_PLACEHOLDERS.pr).toMatch(/^https:\/\/github\.com/)
  })

  it('figma placeholder is a Figma URL', () => {
    expect(OUTPUT_TYPE_PLACEHOLDERS.figma).toMatch(/^https:\/\/figma\.com/)
  })
})

// ── hasDiscrepancy ────────────────────────────────────────────────────────────

const taskNoLink: TaskItem = { description: 'Fix bug', output_type: 'pr', output_link: '' }
const taskWithLink: TaskItem = {
  description: 'Fix bug',
  output_type: 'pr',
  output_link: 'https://github.com/org/repo/pull/1',
}
const taskNoLinkField: TaskItem = { description: 'Fix bug', output_type: 'pr' }

describe('hasDiscrepancy', () => {
  it('returns true: hours > 4, 1 task, no output_link', () => {
    expect(hasDiscrepancy(5, [taskNoLink])).toBe(true)
  })

  it('returns false: hours = 4 (boundary — not strictly greater)', () => {
    expect(hasDiscrepancy(4, [taskNoLink])).toBe(false)
  })

  it('returns false: hours = 4.0 (same boundary)', () => {
    expect(hasDiscrepancy(4.0, [taskNoLink])).toBe(false)
  })

  it('returns true: hours = 4.5 (above boundary)', () => {
    expect(hasDiscrepancy(4.5, [taskNoLink])).toBe(true)
  })

  it('returns false: hours > 4, 2 tasks (length > 1)', () => {
    expect(hasDiscrepancy(8, [taskNoLink, taskNoLink])).toBe(false)
  })

  it('returns false: hours > 4, 1 task with valid output_link', () => {
    expect(hasDiscrepancy(8, [taskWithLink])).toBe(false)
  })

  it('returns false: hours <= 4 even with 1 task no link', () => {
    expect(hasDiscrepancy(3, [taskNoLink])).toBe(false)
  })

  it('returns true: hours > 4, tasks = [] (empty array, length 0 ≤ 1)', () => {
    expect(hasDiscrepancy(5, [])).toBe(true)
  })

  it('returns true: output_link is whitespace — trim() nên không tính là có link', () => {
    const taskWhitespaceLink: TaskItem = {
      description: 'task',
      output_type: 'other',
      output_link: '   ',
    }
    // whitespace link → .trim() === '' → không tính là có link → discrepancy still true
    expect(hasDiscrepancy(5, [taskWhitespaceLink])).toBe(true)
  })

  it('returns false: task without output_link field (undefined)', () => {
    // 1 task, no link field at all, but hours <= 4 → false
    expect(hasDiscrepancy(3, [taskNoLinkField])).toBe(false)
  })

  it('returns true: task without output_link field, hours > 4', () => {
    expect(hasDiscrepancy(8, [taskNoLinkField])).toBe(true)
  })
})
