import { describe, it, expect } from 'vitest'
import {
  dailyReportFormSchema,
  taskItemSchema,
  taskItemFormSchema,
  outputTypeSchema,
  OUTPUT_TYPE_LABELS,
  OUTPUT_TYPE_PLACEHOLDERS,
  hasDiscrepancy,
  computeStreak,
  isWithinEditWindow,
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

  // ── hours field (taskItemSchema — optional, backward compat) ──────────────
  it('hours: 0.5 → valid', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: 0.5 })
    expect(result.success).toBe(true)
  })

  it('hours: 0 → valid (optional, 0 >= 0)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: 0 })
    expect(result.success).toBe(true)
  })

  it('hours: undefined → valid (optional in taskItemSchema)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: undefined })
    expect(result.success).toBe(true)
  })

  it('hours: -1 → invalid (min 0)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: -1 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Số giờ không được âm')
  })

  it('hours: 25 → invalid (max 24)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: 25 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Tối đa 24h')
  })

  it('hours: 0.3 → invalid (không phải bội số 0.5)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: 0.3 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Bội số 0.5')
  })

  it('hours: 24 → valid (boundary)', () => {
    const result = taskItemSchema.safeParse({ description: 'Task', output_type: 'other', hours: 24 })
    expect(result.success).toBe(true)
  })
})

// ── taskItemFormSchema (hours required) ──────────────────────────────────────

describe('taskItemFormSchema — hours required', () => {
  it('valid task with hours passes', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 2 })
    expect(result.success).toBe(true)
  })

  it('hours missing → invalid (required)', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Bắt buộc')
  })

  it('hours: undefined → invalid (required)', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: undefined })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Bắt buộc')
  })

  it('hours: 0 → invalid (min 0.5)', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Tối thiểu 0.5h')
  })

  it('hours: 0.5 → valid', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 0.5 })
    expect(result.success).toBe(true)
  })

  it('hours: 24 → valid (boundary)', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 24 })
    expect(result.success).toBe(true)
  })

  it('hours: 25 → invalid (max 24)', () => {
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 25 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Tối đa 24h')
  })

  it('hours: 1.3 → invalid (không phải bội số 0.5)', () => {
    // 1.3 > 0.5 nên min passes, nhưng 1.3 không phải bội số 0.5
    const result = taskItemFormSchema.safeParse({ description: 'Task', output_type: 'other', hours: 1.3 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Bội số 0.5')
  })
})

// ── dailyReportFormSchema ────────────────────────────────────────────────────

describe('dailyReportFormSchema', () => {
  // hours bắt buộc trong form schema (Story 4.5 update)
  const validForm = {
    tasks: [{ description: 'Fix bug', output_type: 'pr', output_link: '', hours: 2 }],
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

  it('accepts hours_logged > 24 (no max cap — derived from multi-task sum)', () => {
    const result = dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 25 })
    expect(result.success).toBe(true)
  })

  it('accepts fractional hours_logged (8.5)', () => {
    expect(dailyReportFormSchema.safeParse({ ...validForm, hours_logged: 8.5 }).success).toBe(true)
  })

  it('accepts multiple tasks', () => {
    const result = dailyReportFormSchema.safeParse({
      tasks: [
        { description: 'Task 1', output_type: 'pr', output_link: 'https://github.com/org/repo/pull/1', hours: 3 },
        { description: 'Task 2', output_type: 'figma', output_link: '', hours: 2 },
        { description: 'Task 3', output_type: 'other', hours: 1 },
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

  it('pr label is PR / MR', () => {
    expect(OUTPUT_TYPE_LABELS.pr).toBe('PR / MR')
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

  // ── Per-task hours path (Story 4.5) ──────────────────────────────────────
  it('per-task hours: all tasks have hours:2.5, sum=2.5, 1 task no link → false (allHasTaskHours bypasses flag)', () => {
    const task: TaskItem = { description: 'Task', output_type: 'other', output_link: '', hours: 2.5 }
    expect(hasDiscrepancy(0, [task])).toBe(false)
  })

  it('per-task hours: 1 task hours:5, sum=5 > 4, no link → false (allHasTaskHours → no flag)', () => {
    const task: TaskItem = { description: 'Task', output_type: 'other', output_link: '', hours: 5 }
    expect(hasDiscrepancy(0, [task])).toBe(false)
  })

  it('per-task hours: all tasks hours:2, sum=4, 1 task no link → false (allHasTaskHours → no flag)', () => {
    const task: TaskItem = { description: 'Task', output_type: 'other', output_link: '', hours: 2 }
    expect(hasDiscrepancy(0, [task])).toBe(false)
  })

  it('per-task hours: all tasks hours:3, sum=6, task has output_link → false', () => {
    const task: TaskItem = { description: 'Task', output_type: 'pr', output_link: 'https://github.com/org/repo/pull/1', hours: 3 }
    expect(hasDiscrepancy(0, [task])).toBe(false)
  })

  it('per-task hours: 1 of 2 tasks has hours → not allHasTaskHours → fallback to hoursLogged', () => {
    const taskWithHours: TaskItem = { description: 'Task A', output_type: 'other', output_link: '', hours: 5 }
    const taskNoHours: TaskItem = { description: 'Task B', output_type: 'other', output_link: '' }
    // Not allHasTaskHours → use hoursLogged=8, 2 tasks (length > 1) → false
    expect(hasDiscrepancy(8, [taskWithHours, taskNoHours])).toBe(false)
  })

  it('per-task hours fallback: only 1 task no hours, hoursLogged=5, no link → true', () => {
    const task: TaskItem = { description: 'Task', output_type: 'other', output_link: '' }
    // task.hours = undefined → not allHasTaskHours → fallback to hoursLogged=5
    expect(hasDiscrepancy(5, [task])).toBe(true)
  })
})

// ── computeStreak ─────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  // 2026-03-24 = Thứ 3 (Tuesday)
  const today = '2026-03-24'

  it('returns 0 khi reportDates array rỗng', () => {
    expect(computeStreak([], today)).toBe(0)
  })

  it('returns 1 khi chỉ có hôm nay', () => {
    expect(computeStreak([today], today)).toBe(1)
  })

  it('returns 3 khi có 3 ngày liên tiếp (T3, T2, CN)', () => {
    // 2026-03-24 T3, 2026-03-23 T2, 2026-03-22 CN (weekend → tính)
    const dates = ['2026-03-24', '2026-03-23', '2026-03-22']
    expect(computeStreak(dates, today)).toBe(3)
  })

  it('returns 1 khi hôm nay T3 có nhưng T2 hôm qua bị đứt', () => {
    // 2026-03-23 T2 bị thiếu — là ngày thường → break
    const dates = ['2026-03-24', '2026-03-22'] // bỏ 23
    expect(computeStreak(dates, today)).toBe(1)
  })

  it('hôm nay chưa nộp nhưng hôm qua (T2) đã nộp — hiển thị streak từ T2', () => {
    // today = '2026-03-24' (T3), T3 chưa nộp
    // New behavior: T3 chưa nộp → candidate = T2 (23) → has(23) = YES → streak từ T2
    const dates = ['2026-03-23', '2026-03-22', '2026-03-21']
    expect(computeStreak(dates, today)).toBe(3)
  })

  it('T3 chưa nộp, chỉ có T2 hôm qua → streak = 1 (yesterday fallback)', () => {
    // today = '2026-03-24' (T3), T3 chưa nộp → candidate = T2 (23) → has = YES → streak = 1
    const dates = ['2026-03-23']
    expect(computeStreak(dates, today)).toBe(1)
  })

  it('trả về đúng streak khi dates không theo thứ tự', () => {
    const dates = ['2026-03-22', '2026-03-24', '2026-03-23']
    expect(computeStreak(dates, today)).toBe(3)
  })

  it('streak dài hơn — 5 ngày liên tiếp (T3 → T7)', () => {
    // 2026-03-24 T3, 23 T2, 22 CN, 21 T7, 20 T6
    const dates = ['2026-03-24', '2026-03-23', '2026-03-22', '2026-03-21', '2026-03-20']
    expect(computeStreak(dates, today)).toBe(5)
  })

  // ── Weekend skipping ──────────────────────────────────────────────────────

  it('T7/CN không nộp không phá streak — T2 kết nối với T6 qua weekend', () => {
    // today = '2026-03-23' (Thứ 2), có T6 trước đó (20), skip T7(21)+CN(22)
    const monday = '2026-03-23'
    const dates = ['2026-03-23', '2026-03-20'] // T2 + T6, không có T7/CN
    expect(computeStreak(dates, monday)).toBe(2)
  })

  it('T7/CN có nộp vẫn tính vào streak', () => {
    // today = '2026-03-23' (T2), nộp cả T7/CN
    const monday = '2026-03-23'
    const dates = ['2026-03-23', '2026-03-22', '2026-03-21', '2026-03-20'] // T2+CN+T7+T6
    expect(computeStreak(dates, monday)).toBe(4)
  })

  it('T7 không nộp nhưng CN nộp — CN vẫn tính, streak không đứt', () => {
    // today = '2026-03-23' (T2), CN(22) nộp, T7(21) không nộp, T6(20) nộp
    const monday = '2026-03-23'
    const dates = ['2026-03-23', '2026-03-22', '2026-03-20'] // T2+CN+T6, thiếu T7
    expect(computeStreak(dates, monday)).toBe(3)
  })

  it('T2 chưa nộp, nhưng CN+T7 tuần trước đã nộp → streak = 2 (weekend fallback)', () => {
    // today = '2026-03-23' (T2), T2 chưa nộp
    // candidate = CN (22) → isWeekend && has(22)=YES → while exits → startDay = CN → streak=2
    const monday = '2026-03-23'
    const dates = ['2026-03-22', '2026-03-21']
    expect(computeStreak(dates, monday)).toBe(2)
  })

  it('xử lý đúng với date string không hợp lệ trong array — không crash', () => {
    const dates = ['2026-03-24', 'invalid-date', '2026-03-23']
    // 'invalid-date' không làm crash, streak vẫn tính được từ valid dates
    expect(() => computeStreak(dates, today)).not.toThrow()
  })

  // ── Yesterday fallback (Bug 9-6 fix) ─────────────────────────────────────

  it('T2 chưa nộp, CN+T7 không nộp, T6 đã nộp → tính streak từ T6', () => {
    // today = '2026-03-23' (T2), chưa nộp
    // candidate = CN (22) → weekend, không nộp → skip
    // candidate = T7 (21) → weekend, không nộp → skip
    // candidate = T6 (20) → không phải weekend → has(20)=YES → startDay = T6 → streak = 3
    const monday = '2026-03-23'
    const dates = ['2026-03-20', '2026-03-19', '2026-03-18'] // T6, T5, T4
    expect(computeStreak(dates, monday)).toBe(3)
  })

  it('T3 chưa nộp, T2 là ngày thường không nộp → streak = 0 (đứt thực sự)', () => {
    // today = '2026-03-24' (T3), T3 chưa nộp
    // candidate = T2 (23) → không phải weekend → has(23)=NO → return 0
    const dates = ['2026-03-22', '2026-03-21'] // CN, T7 có nộp nhưng T2 (23) không nộp
    expect(computeStreak(dates, '2026-03-24')).toBe(0)
  })

  it('array rỗng, hôm nay chưa nộp — yesterday fallback cũng không tìm được → streak = 0', () => {
    // Cả today lẫn yesterday đều không có → return 0
    expect(computeStreak([], '2026-03-24')).toBe(0)
  })

  // ── Today = weekend (P2 coverage) ────────────────────────────────────────

  it('T7 chưa nộp, T6 đã nộp → yesterday fallback không qua weekend-skip, streak từ T6', () => {
    // today = '2026-03-21' (T7), T7 chưa nộp
    // candidate = T6 (20) → isWeekend(T6)=false → while không chạy
    // dateSet.has(T6)=YES → startDay = T6 → streak = 3 (T6+T5+T4)
    const saturday = '2026-03-21'
    const dates = ['2026-03-20', '2026-03-19', '2026-03-18'] // T6, T5, T4
    expect(computeStreak(dates, saturday)).toBe(3)
  })

  it('CN chưa nộp, T7 chưa nộp, T6 đã nộp → skip T7 (weekend không nộp), streak từ T6', () => {
    // today = '2026-03-22' (CN), CN chưa nộp
    // candidate = T7 (21) → isWeekend=true, !has(21)=true → skip → candidate = T6 (20)
    // isWeekend(T6)=false → while thoát → has(T6)=YES → startDay = T6 → streak = 2
    const sunday = '2026-03-22'
    const dates = ['2026-03-20', '2026-03-19'] // T6, T5
    expect(computeStreak(dates, sunday)).toBe(2)
  })

  // ── Partial weekend (P3 coverage) ────────────────────────────────────────

  it('T2 chưa nộp, CN đã nộp nhưng T7 chưa nộp → streak chỉ tính CN (không bridge qua T7)', () => {
    // today = '2026-03-23' (T2), T2 chưa nộp
    // candidate = CN (22) → isWeekend=true, !has(22)=false (đã nộp) → while thoát ngay
    // startDay = CN → main loop: CN(+1), T7(weekend skip — không nộp), T6(not submitted → break)
    // streak = 1
    const monday = '2026-03-23'
    const dates = ['2026-03-22'] // chỉ CN, T7 không nộp
    expect(computeStreak(dates, monday)).toBe(1)
  })
})

// ── isWithinEditWindow ────────────────────────────────────────────────────────

describe('isWithinEditWindow', () => {
  const TZ = 'Asia/Ho_Chi_Minh'  // UTC+7

  // ── Regression tests (dùng far-future/past date) ──────────────────────────

  it('còn trong window: deadline 3am hôm sau, now = 11pm hôm nay → true', () => {
    // reportDate cực xa trong tương lai → deadline chưa qua → true
    expect(isWithinEditWindow('2099-12-30', 3, TZ)).toBe(true)
  })

  it('đã qua window: deadline đã qua → false', () => {
    // reportDate rất xa trong quá khứ → deadline chắc chắn đã qua
    expect(isWithinEditWindow('2020-01-01', 3, TZ)).toBe(false)
  })

  it('report ngày hôm qua thông thường → false (window đã đóng sau 3am)', () => {
    expect(isWithinEditWindow('2019-06-15', 0, TZ)).toBe(false)
  })

  it('timezone không hợp lệ → false (safe default)', () => {
    expect(isWithinEditWindow('2099-12-30', 3, 'Invalid/Timezone')).toBe(false)
  })

  it('timezone empty string → false (safe default)', () => {
    expect(isWithinEditWindow('2099-12-30', 3, '')).toBe(false)
  })

  it('reportDate không hợp lệ → false (safe default từ try/catch)', () => {
    expect(isWithinEditWindow('not-a-date', 3, TZ)).toBe(false)
  })

  it('deadline hour = 0 (midnight) với UTC → vẫn tính đúng', () => {
    expect(isWithinEditWindow('2099-12-30', 0, 'UTC')).toBe(true)
  })

  it('deadline hour = 23 với UTC → vẫn tính đúng', () => {
    expect(isWithinEditWindow('2099-12-30', 23, 'UTC')).toBe(true)
  })

  // ── Deterministic boundary tests (now injection) ──────────────────────────
  // report_date = '2026-03-25', deadlineHour = 3, TZ = Asia/Ho_Chi_Minh (UTC+7)
  // → deadline = 2026-03-26T03:00:00 ICT = 2026-03-25T20:00:00 UTC

  it('1am ICT (18:00 UTC) < deadline 3am ICT (20:00 UTC) → còn trong window', () => {
    const beforeDeadline = new Date('2026-03-25T18:00:00Z')  // 1am ICT ngày 26
    expect(isWithinEditWindow('2026-03-25', 3, TZ, beforeDeadline)).toBe(true)
  })

  it('5am ICT (22:00 UTC) > deadline 3am ICT (20:00 UTC) → đã qua window', () => {
    const afterDeadline = new Date('2026-03-25T22:00:00Z')  // 5am ICT ngày 26
    expect(isWithinEditWindow('2026-03-25', 3, TZ, afterDeadline)).toBe(false)
  })

  it('đúng thời điểm deadline (20:00 UTC) → false (isBefore là strict <)', () => {
    const atDeadline = new Date('2026-03-25T20:00:00Z')  // 3am ICT ngày 26 — đúng deadline
    expect(isWithinEditWindow('2026-03-25', 3, TZ, atDeadline)).toBe(false)
  })

  it('1 giây trước deadline → true', () => {
    const justBefore = new Date('2026-03-25T19:59:59Z')  // 02:59:59 ICT
    expect(isWithinEditWindow('2026-03-25', 3, TZ, justBefore)).toBe(true)
  })
})
