import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  normalizeVietnamese,
  findBestMatch,
  autoMapAuthors,
  getSavedMappings,
  saveMapping,
  updateMapping,
  clearSavedMappings,
} from '../lib/user-mapping'
import type { AuthorMapping } from '../types/ai-parse.types'

const mockUsers = [
  { id: 'u1', full_name: 'Nguyễn Văn An' },
  { id: 'u2', full_name: 'Trần Thị Bình' },
  { id: 'u3', full_name: 'Lê Hoàng Cường' },
  { id: 'u4', full_name: 'Phạm Minh Đức' },
]

// ── Normalization tests (M1–M3) ────────────────────────────────────────────

describe('normalizeVietnamese', () => {
  it('M1: strips diacritics correctly', () => {
    expect(normalizeVietnamese('Nguyễn')).toBe('nguyen')
    expect(normalizeVietnamese('Trần')).toBe('tran')
    // đ → d (lowercase), then entire string is lowercased
    expect(normalizeVietnamese('Đức')).toBe('duc')
  })

  it('M2: collapses whitespace and lowercases', () => {
    expect(normalizeVietnamese('  NGUYỄN  VĂN  AN  ')).toBe('nguyen van an')
  })

  it('M3: handles plain ASCII names', () => {
    expect(normalizeVietnamese('John Doe')).toBe('john doe')
  })
})

// ── findBestMatch tests (M4–M8) ───────────────────────────────────────────

describe('findBestMatch', () => {
  it('M4: exact diacritic match returns confidence 1.0', () => {
    const result = findBestMatch('Nguyễn Văn An', mockUsers)
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe('u1')
    expect(result!.confidence).toBe(1.0)
  })

  it('M5: ASCII variant of name matches with high confidence', () => {
    const result = findBestMatch('Nguyen Van An', mockUsers)
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe('u1')
    expect(result!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('M6: partial match (first/last name only) works', () => {
    const result = findBestMatch('Văn An', mockUsers)
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe('u1')
  })

  it('M7: no match below threshold returns null', () => {
    const result = findBestMatch('Completely Unknown Person XYZ', mockUsers)
    expect(result).toBeNull()
  })

  it('M8: empty externalAuthor returns null', () => {
    const result = findBestMatch('', mockUsers)
    expect(result).toBeNull()
  })
})

// ── autoMapAuthors tests (L1–L5) ──────────────────────────────────────────

describe('autoMapAuthors', () => {
  beforeEach(() => {
    // Clear localStorage and in-memory cache before each test
    clearSavedMappings('test-tenant')
    vi.restoreAllMocks()
  })

  it('L1: exact name maps correctly', () => {
    const result = autoMapAuthors(['Nguyễn Văn An'], mockUsers, 'test-tenant')
    expect(result['Nguyễn Văn An']).toBeDefined()
    expect(result['Nguyễn Văn An']!.userId).toBe('u1')
  })

  it('L2: duplicate authors return same mapping', () => {
    const result = autoMapAuthors(
      ['Nguyễn Văn An', 'Nguyễn Văn An'],
      mockUsers,
      'test-tenant'
    )
    expect(Object.keys(result).length).toBe(1)
    expect(result['Nguyễn Văn An']!.userId).toBe('u1')
  })

  it('L3: unmapped author not in result', () => {
    const result = autoMapAuthors(['Unknown Person'], mockUsers, 'test-tenant')
    expect(result['Unknown Person']).toBeUndefined()
  })

  it('L4: multiple authors map correctly', () => {
    const result = autoMapAuthors(
      ['Nguyễn Văn An', 'Trần Thị Bình'],
      mockUsers,
      'test-tenant'
    )
    expect(result['Nguyễn Văn An']!.userId).toBe('u1')
    expect(result['Trần Thị Bình']!.userId).toBe('u2')
  })

  it('L5: user not in tenant returns null mapping', () => {
    // Only one user available
    const result = autoMapAuthors(['Nguyễn Văn An'], [{ id: 'other', full_name: 'Other User' }], 'test-tenant')
    expect(result['Nguyễn Văn An']).toBeUndefined()
  })
})

// ── localStorage persistence tests ──────────────────────────────────────────

describe('localStorage persistence', () => {
  const tenantId = 'test-tenant'

  beforeEach(() => {
    clearSavedMappings(tenantId)
  })

  it('persists and retrieves mapping', () => {
    const mapping: AuthorMapping = {
      externalAuthor: 'John',
      userId: 'u1',
      confidence: 0.9,
    }
    saveMapping(tenantId, 'John', mapping)
    const saved = getSavedMappings(tenantId)
    expect(saved['John']).toBeDefined()
    expect(saved['John']!.userId).toBe('u1')
  })

  it('updateMapping replaces existing mapping', () => {
    const original: AuthorMapping = {
      externalAuthor: 'John',
      userId: 'u1',
      confidence: 0.5,
    }
    const updated: AuthorMapping = {
      externalAuthor: 'John',
      userId: 'u2',
      confidence: 1.0,
    }
    saveMapping(tenantId, 'John', original)
    updateMapping(tenantId, 'John', updated)
    const saved = getSavedMappings(tenantId)
    expect(saved['John']!.userId).toBe('u2')
    expect(saved['John']!.confidence).toBe(1.0)
  })

  it('clearSavedMappings removes all mappings', () => {
    const mapping: AuthorMapping = {
      externalAuthor: 'John',
      userId: 'u1',
      confidence: 0.9,
    }
    saveMapping(tenantId, 'John', mapping)
    clearSavedMappings(tenantId)
    const saved = getSavedMappings(tenantId)
    expect(saved['John']).toBeUndefined()
  })
})
