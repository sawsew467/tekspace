import type { AuthorMapping } from '../types/ai-parse.types'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CACHE_SIZE = 50
const STORAGE_PREFIX = 'import_mapping_'

// ── Vietnamese normalization ───────────────────────────────────────────────────

/**
 * Strip Vietnamese diacritics to get base Latin characters.
 * Handles all Vietnamese vowel combinations including rare ones.
 */
function stripDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D')) // đ → d
    .toLowerCase()
    .trim()
}

/**
 * Normalize a string for matching: strip diacritics, collapse whitespace, lowercase.
 */
export function normalizeVietnamese(text: string): string {
  return stripDiacritics(text).replace(/\s+/g, ' ')
}

/**
 * Extract name parts for partial matching.
 * "Nguyen Van A" → ["nguyen", "van", "a", "nguyenvana", "van a", ...]
 */
function extractNameParts(name: string): string[] {
  const normalized = normalizeVietnamese(name)
  const words = normalized.split(' ').filter(Boolean)
  const parts: string[] = [normalized, ...words]

  // Add bigrams and trigrams
  for (let i = 0; i < words.length - 1; i++) {
    parts.push(`${words[i]} ${words[i + 1]}`)
  }
  if (words.length >= 2) {
    parts.push(words[words.length - 2] + words[words.length - 1])
    parts.push(words[0] + words[words.length - 1])
  }
  return [...new Set(parts)]
}

// ── Matching ──────────────────────────────────────────────────────────────────

interface TekSpaceUser {
  id: string
  full_name: string
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Compute similarity score 0–1 between two strings.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * Find the best TekSpace user match for an external author name.
 * Returns the user with highest confidence, or null if confidence < threshold.
 */
export function findBestMatch(
  externalAuthor: string,
  users: TekSpaceUser[],
): { user: TekSpaceUser; confidence: number } | null {
  if (!externalAuthor.trim() || users.length === 0) return null

  const normalizedExternal = normalizeVietnamese(externalAuthor)
  const externalParts = extractNameParts(externalAuthor)

  let best: { user: TekSpaceUser; confidence: number } | null = null

  for (const user of users) {
    const normalizedUser = normalizeVietnamese(user.full_name)
    const userParts = extractNameParts(user.full_name)

    // Exact match after normalization
    if (normalizedExternal === normalizedUser) {
      return { user, confidence: 1.0 }
    }

    // Best partial match
    let maxSim = 0
    for (const ep of externalParts) {
      for (const up of userParts) {
        const sim = similarity(ep, up)
        if (sim > maxSim) maxSim = sim
      }
    }

    // Also check if one contains the other
    if (normalizedUser.includes(normalizedExternal) || normalizedExternal.includes(normalizedUser)) {
      maxSim = Math.max(maxSim, 0.85)
    }

    if (maxSim > 0.6 && (!best || maxSim > best.confidence)) {
      best = { user, confidence: maxSim }
    }
  }

  return best
}

// ── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache {
  private cache = new Map<string, AuthorMapping>()

  get(key: string): AuthorMapping | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: AuthorMapping): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= MAX_CACHE_SIZE) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// In-memory LRU cache per tenant
const lruCache = new LRUCache()

// ── localStorage persistence ─────────────────────────────────────────────────

function storageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`
}

function loadFromStorage(tenantId: string): Record<string, AuthorMapping> {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, AuthorMapping>
    // Re-populate in-memory cache from storage
    for (const [key, value] of Object.entries(parsed)) {
      lruCache.set(key, value)
    }
    return parsed
  } catch {
    return {}
  }
}

function saveToStorage(tenantId: string, mappings: Record<string, AuthorMapping>): void {
  try {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(mappings))
  } catch {
    // localStorage may be full or unavailable (e.g., private browsing)
    // Silently fail — in-memory cache still works
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all saved mappings for a tenant from localStorage + in-memory cache.
 */
export function getSavedMappings(tenantId: string): Record<string, AuthorMapping> {
  return loadFromStorage(tenantId)
}

/**
 * Save a single mapping and persist to localStorage.
 */
export function saveMapping(
  tenantId: string,
  externalAuthor: string,
  mapping: AuthorMapping,
): void {
  const mappings = loadFromStorage(tenantId)
  mappings[externalAuthor] = mapping
  saveToStorage(tenantId, mappings)
}

/**
 * Get a cached mapping for an external author (without user lookup).
 */
export function getCachedMapping(
  _tenantId: string,
  externalAuthor: string,
): AuthorMapping | undefined {
  return lruCache.get(externalAuthor)
}

/**
 * Auto-map a list of external authors to TekSpace users.
 * Uses saved mappings first, then fuzzy matching.
 * Returns a Record<externalAuthor, AuthorMapping>.
 */
export function autoMapAuthors(
  externalAuthors: string[],
  users: TekSpaceUser[],
  tenantId: string,
): Record<string, AuthorMapping> {
  const savedMappings = getSavedMappings(tenantId)
  const result: Record<string, AuthorMapping> = {}

  for (const author of externalAuthors) {
    // Check saved mapping first
    if (savedMappings[author]) {
      // Verify user still exists
      const userExists = users.some((u) => u.id === savedMappings[author]!.userId)
      if (userExists) {
        result[author] = savedMappings[author]!
        lruCache.set(author, savedMappings[author]!)
        continue
      }
    }

    // Check in-memory cache
    const cached = lruCache.get(author)
    if (cached && users.some((u) => u.id === cached.userId)) {
      result[author] = cached
      continue
    }

    // Fuzzy match
    const match = findBestMatch(author, users)
    if (match) {
      result[author] = {
        externalAuthor: author,
        userId: match.user.id,
        confidence: match.confidence,
      }
      lruCache.set(author, result[author])
    }
  }

  return result
}

/**
 * Update a single mapping and persist.
 */
export function updateMapping(
  tenantId: string,
  externalAuthor: string,
  mapping: AuthorMapping,
): Record<string, AuthorMapping> {
  const mappings = getSavedMappings(tenantId)
  mappings[externalAuthor] = mapping
  saveToStorage(tenantId, mappings)
  lruCache.set(externalAuthor, mapping)
  return mappings
}

/**
 * Clear all saved mappings for a tenant.
 */
export function clearSavedMappings(tenantId: string): void {
  localStorage.removeItem(storageKey(tenantId))
  lruCache.clear()
}
