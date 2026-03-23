/**
 * Cookie utility functions using manual document.cookie approach
 * Replaces js-cookie dependency for better consistency
 */

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * Kiểm tra xem đang chạy trên HTTPS không (để thêm Secure flag)
 */
function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  const encodedName = encodeURIComponent(name)
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${encodedName}=`)
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift()
    if (cookieValue !== undefined) {
      try {
        return decodeURIComponent(cookieValue)
      } catch {
        return cookieValue
      }
    }
  }
  return undefined
}

/**
 * Set a cookie with name, value, and optional max age
 * - SameSite=Lax: ngăn CSRF cross-site requests
 * - Secure: chỉ gửi qua HTTPS (tự động khi chạy trên HTTPS)
 */
export function setCookie(
  name: string,
  value: string,
  maxAge: number = DEFAULT_MAX_AGE
): void {
  if (typeof document === 'undefined') return

  const encodedName = encodeURIComponent(name)
  const encodedValue = encodeURIComponent(value)
  const secure = isSecureContext() ? '; Secure' : ''

  document.cookie = `${encodedName}=${encodedValue}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

/**
 * Remove a cookie by setting its max age to 0
 * Phải dùng cùng attributes với lúc set để browser match đúng cookie
 */
export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return

  const encodedName = encodeURIComponent(name)
  const secure = isSecureContext() ? '; Secure' : ''

  document.cookie = `${encodedName}=; path=/; max-age=0; SameSite=Lax${secure}`
}
