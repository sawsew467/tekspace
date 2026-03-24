import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationsService } from '../services/notifications.service'

// ── Mock Supabase ─────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase-browser', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase-browser'

/**
 * Build a chainable Supabase query mock that resolves with `finalResult`
 * when awaited. All intermediate methods return the chain itself.
 */
function buildChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  // Create a promise that resolves with finalResult
  const resolver = Promise.resolve(finalResult)

  // Chain object: all methods return itself (chainable), and it's also a thenable
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    then: resolver.then.bind(resolver),
    catch: resolver.catch.bind(resolver),
  }

  // All methods return the chain itself for chaining
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)

  return chain
}

const mockNotifications = [
  {
    id: 'notif-1',
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    type: 'schedule_reminder' as const,
    message: 'Nhắc nhở: Hạn đăng ký lịch',
    is_read: false,
    link_to: '/schedule',
    created_at: '2026-03-24T10:00:00Z',
  },
  {
    id: 'notif-2',
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    type: 'daily_report_reminder' as const,
    message: 'Nhắc nhở: Nộp daily report',
    is_read: true,
    link_to: '/daily-report',
    created_at: '2026-03-24T09:00:00Z',
  },
]

// ── getNotifications ─────────────────────────────────────────────────────────

describe('NotificationsService.getNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns notifications array on success', async () => {
    const chain = buildChain({ data: mockNotifications, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    const result = await NotificationsService.getNotifications('tenant-1', 'user-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('notif-1')
    expect(result[1].id).toBe('notif-2')
  })

  it('returns empty array when data is null', async () => {
    const chain = buildChain({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    const result = await NotificationsService.getNotifications('tenant-1', 'user-1')
    expect(result).toEqual([])
  })

  it('throws on supabase error', async () => {
    const chain = buildChain({ data: null, error: { message: 'DB error' } })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.getNotifications('tenant-1', 'user-1')
    ).rejects.toEqual({ message: 'DB error' })
  })

  it('calls from(notifications) with correct filters', async () => {
    const chain = buildChain({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await NotificationsService.getNotifications('tenant-abc', 'user-xyz')

    expect(supabase.from).toHaveBeenCalledWith('notifications')
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-abc')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-xyz')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(50)
  })
})

// ── getUnreadCount ────────────────────────────────────────────────────────────

describe('NotificationsService.getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unread count on success', async () => {
    const chain = buildChain({ count: 5, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    const result = await NotificationsService.getUnreadCount('tenant-1', 'user-1')
    expect(result).toBe(5)
  })

  it('returns 0 when count is null', async () => {
    const chain = buildChain({ count: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    const result = await NotificationsService.getUnreadCount('tenant-1', 'user-1')
    expect(result).toBe(0)
  })

  it('throws on supabase error', async () => {
    const chain = buildChain({ count: null, error: { message: 'Query failed' } })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.getUnreadCount('tenant-1', 'user-1')
    ).rejects.toEqual({ message: 'Query failed' })
  })

  it('queries with is_read=false filter', async () => {
    const chain = buildChain({ count: 3, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await NotificationsService.getUnreadCount('tenant-1', 'user-1')

    expect(chain.eq).toHaveBeenCalledWith('is_read', false)
  })

  it('uses count: exact with head: true to avoid fetching rows', async () => {
    const chain = buildChain({ count: 0, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await NotificationsService.getUnreadCount('tenant-1', 'user-1')

    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  })
})

// ── markAsRead ────────────────────────────────────────────────────────────────

describe('NotificationsService.markAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves without error on success', async () => {
    const chain = buildChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.markAsRead('notif-1')
    ).resolves.toBeUndefined()
  })

  it('throws on supabase error', async () => {
    const chain = buildChain({ error: { message: 'Update failed' } })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.markAsRead('notif-1')
    ).rejects.toEqual({ message: 'Update failed' })
  })

  it('sets is_read=true for the correct notification id', async () => {
    const chain = buildChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await NotificationsService.markAsRead('notif-abc')

    expect(chain.update).toHaveBeenCalledWith({ is_read: true })
    expect(chain.eq).toHaveBeenCalledWith('id', 'notif-abc')
  })
})

// ── markAllAsRead ─────────────────────────────────────────────────────────────

describe('NotificationsService.markAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves without error on success', async () => {
    const chain = buildChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.markAllAsRead('tenant-1', 'user-1')
    ).resolves.toBeUndefined()
  })

  it('throws on supabase error', async () => {
    const chain = buildChain({ error: { message: 'Bulk update failed' } })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await expect(
      NotificationsService.markAllAsRead('tenant-1', 'user-1')
    ).rejects.toEqual({ message: 'Bulk update failed' })
  })

  it('filters by tenant_id, user_id, and is_read=false', async () => {
    const chain = buildChain({ error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await NotificationsService.markAllAsRead('tenant-xyz', 'user-xyz')

    expect(chain.update).toHaveBeenCalledWith({ is_read: true })
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-xyz')
    expect(chain.eq).toHaveBeenCalledWith('is_read', false)
  })
})
