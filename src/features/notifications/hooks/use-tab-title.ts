import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'

/**
 * Cập nhật document.title với prefix "(N)" khi có unread notifications.
 * - Dùng setTimeout(0) để đợi HeadContent (TanStack Router) set title trước
 * - Sau đó strip prefix cũ và re-apply với count mới
 * - pathname làm dependency để re-run khi navigate
 */
export function useTabTitle(unreadCount: number) {
  const { pathname } = useLocation()

  useEffect(() => {
    // setTimeout(0): đợi HeadContent (TanStack Router) set title trước
    const timer = setTimeout(() => {
      // Strip existing prefix nếu có: "(3) Title" → "Title"
      // Dùng + quantifier để strip nhiều prefix liên tiếp nếu có (tránh accumulate)
      const baseTitle = document.title.replace(/^(\(\d+\+?\)\s)+/, '')

      if (unreadCount > 0) {
        const badge = unreadCount > 99 ? '99+' : String(unreadCount)
        document.title = `(${badge}) ${baseTitle}`
      } else {
        // Đảm bảo prefix đã bị xóa (clean title)
        document.title = baseTitle
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [pathname, unreadCount])
}
