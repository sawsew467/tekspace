import { useState, useCallback, useRef } from 'react'

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied'

// Module-level constant — chỉ evaluate một lần, tránh re-compute mỗi render
const IS_NOTIFICATION_SUPPORTED =
  typeof window !== 'undefined' && 'Notification' in window

/**
 * Quản lý Browser Notification API permission state.
 * - isSupported: false khi trình duyệt không hỗ trợ Notification API
 * - permission: trạng thái hiện tại ('default' | 'granted' | 'denied')
 * - requestPermission(): yêu cầu permission từ user (idempotent — safe to call nhiều lần)
 */
export function useBrowserNotifications() {
  // Lazy initializer đọc Notification.permission trực tiếp khi mount
  // (không cần useEffect sync — browser trả giá trị ngay lập tức)
  const [permission, setPermission] = useState<BrowserNotificationPermission>(() =>
    IS_NOTIFICATION_SUPPORTED
      ? (Notification.permission as BrowserNotificationPermission)
      : 'denied'
  )

  // In-flight guard — tránh duplicate permission dialog khi user click nhanh
  const pendingRef = useRef(false)

  const requestPermission = useCallback(async () => {
    if (!IS_NOTIFICATION_SUPPORTED || pendingRef.current) return
    pendingRef.current = true
    try {
      const result = await Notification.requestPermission()
      setPermission(result as BrowserNotificationPermission)
    } finally {
      pendingRef.current = false
    }
  }, [])

  return { isSupported: IS_NOTIFICATION_SUPPORTED, permission, requestPermission }
}
