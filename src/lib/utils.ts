import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Validate URL chỉ chấp nhận internal relative paths.
 * Chống open redirect attack: từ chối external URL, double-slash, protocol-relative,
 * và các encoded bypass như /%2F%2Fevil.com hay /\evil.com.
 *
 * @example
 * isInternalUrl('/daily-report')        // true ✓
 * isInternalUrl('/dashboard?tab=hours') // true ✓
 * isInternalUrl('https://evil.com')     // false ✗
 * isInternalUrl('//evil.com')           // false ✗
 * isInternalUrl('/%2F%2Fevil.com')      // false ✗ (decoded → //evil.com)
 * isInternalUrl('/\\evil.com')          // false ✗ (backslash bypass)
 * isInternalUrl(undefined)              // false ✗
 */
export function isInternalUrl(url: string | undefined): url is string {
  if (!url) return false
  // Decode trước để catch percent-encoded bypass (/%2F%2Fevil.com → //evil.com)
  let decoded: string
  try {
    decoded = decodeURIComponent(url)
  } catch {
    // Invalid percent-encoding → reject
    return false
  }
  // Chỉ chấp nhận paths bắt đầu bằng /
  // Từ chối: //evil.com (protocol-relative), /\evil.com (backslash, một số browser parse thành //)
  return decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.startsWith('/\\')
}

/**
 * Generates page numbers for pagination with ellipsis
 * @param currentPage - Current page number (1-based)
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis strings
 *
 * Examples:
 * - Small dataset (≤5 pages): [1, 2, 3, 4, 5]
 * - Near beginning: [1, 2, 3, 4, '...', 10]
 * - In middle: [1, '...', 4, 5, 6, '...', 10]
 * - Near end: [1, '...', 7, 8, 9, 10]
 */
export function getPageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5 // Maximum number of page buttons to show
  const rangeWithDots = []

  if (totalPages <= maxVisiblePages) {
    // If total pages is 5 or less, show all pages
    for (let i = 1; i <= totalPages; i++) {
      rangeWithDots.push(i)
    }
  } else {
    // Always show first page
    rangeWithDots.push(1)

    if (currentPage <= 3) {
      // Near the beginning: [1] [2] [3] [4] ... [10]
      for (let i = 2; i <= 4; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    } else if (currentPage >= totalPages - 2) {
      // Near the end: [1] ... [7] [8] [9] [10]
      rangeWithDots.push('...')
      for (let i = totalPages - 3; i <= totalPages; i++) {
        rangeWithDots.push(i)
      }
    } else {
      // In the middle: [1] ... [4] [5] [6] ... [10]
      rangeWithDots.push('...')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    }
  }

  return rangeWithDots
}
