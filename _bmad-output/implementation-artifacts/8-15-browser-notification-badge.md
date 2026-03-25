# Story 8-15: Browser Notification Badge

**Story ID:** 8.15
**Story Key:** 8-15-browser-notification-badge
**Epic:** 8 — UX Polish & Feature Completeness
**Wave:** Wave 4 (sau Wave 3 hoàn thành: 8-9, 8-10, 8-11 done)
**Status:** review
**Created:** 2026-03-25

---

## User Story

> Là một người dùng TekSpace, tôi muốn thấy số thông báo chưa đọc trên tab title trình duyệt, nghe âm thanh ping khi có thông báo mới, và nhận thông báo native của trình duyệt khi đang ở tab khác, để tôi không bỏ lỡ thông báo quan trọng mà không cần phải liên tục kiểm tra app.

---

## Acceptance Criteria

**AC1 — Tab title prefix `(N)`:**
Khi user có N > 0 thông báo chưa đọc, browser tab title hiển thị `(N) <Route Title>` (ví dụ: `(3) Thông báo — TekSpace`).
Khi N = 0, tab title hiển thị bình thường không có prefix.
Khi N > 99, hiển thị `(99+)`.

**AC2 — Tab title cập nhật realtime:**
Khi user mark-as-read hoặc mark-all-read, tab title cập nhật ngay lập tức (không cần F5).
Khi có notification mới (realtime INSERT), tab title tăng số lên ngay.

**AC3 — Tab title đúng trên mọi route:**
Khi navigate giữa các trang, title luôn có prefix đúng.
Ví dụ: navigate từ Notifications sang Dashboard → `(N) Team Dashboard — TekSpace`.

**AC4 — Browser Notification opt-in UI:**
Trên trang Notifications, khi permission là `default` (chưa hỏi), hiển thị một banner/button mời user bật browser notifications.
Khi permission là `granted` → ẩn banner.
Khi permission là `denied` → hiển thị message hướng dẫn cấp quyền trong browser settings.
Khi trình duyệt không hỗ trợ Notification API → ẩn hoàn toàn.

**AC5 — Browser Notification hiển thị khi tab không active:**
Khi user đã grant permission VÀ có notification mới (realtime INSERT) VÀ tab hiện tại không được focus (`document.visibilityState !== 'visible'`), hiển thị browser notification native với title "TekSpace" và body là nội dung thông báo.
Khi tab đang visible → KHÔNG show browser notification (user đã thấy trong app).

**AC6 — Không regression:**
Sidebar badge (số đỏ trên icon Thông báo trong sidebar) vẫn hoạt động đúng.
Mark-as-read, mark-all-read, realtime notification list update — tất cả vẫn hoạt động.
TypeScript không lỗi. ESLint pass.

**AC7 — Âm thanh thông báo:**
Khi có notification mới (realtime INSERT), phát một tiếng "ping" ngắn.
Âm thanh phát bất kể tab đang visible hay hidden (không phụ thuộc permission browser notification).
Không có setting tắt/bật âm thanh (KISS — internal tool).
Khi trình duyệt không hỗ trợ Web Audio API → silent fail, không crash.

---

## Tasks/Subtasks

- [x] **T1 — Tab Title với prefix `(N)`**
  - [x] T1.1 Tạo `use-tab-title.ts` — hook nhận `unreadCount`, watch route changes, update `document.title`
  - [x] T1.2 Mount `useTabTitle(unreadCount)` trong `AppSidebar` (đã có `unreadCount` từ `useUnreadCount`)
  - [x] T1.3 Verify: navigate giữa các trang → prefix vẫn đúng; count = 0 → không có prefix

- [x] **T2 — Browser Notification API — Permission State**
  - [x] T2.1 Tạo `use-browser-notifications.ts` — quản lý permission state + expose `requestPermission()`
  - [x] T2.2 Thêm opt-in UI vào `notifications.tsx` — banner khi `default`, message khi `denied`, ẩn khi `granted`

- [x] **T3 — Trigger Browser Notification + Sound khi có thông báo mới**
  - [x] T3.1 Tạo `src/features/notifications/utils/notification-sound.ts` — `playNotificationSound()` dùng Web Audio API
  - [x] T3.2 Cập nhật `use-notifications-realtime.ts` — gọi `new Notification(...)` khi INSERT, permission granted, tab không visible
  - [x] T3.3 Gọi `playNotificationSound()` trong cùng handler (phát âm thanh bất kể tab state)
  - [x] T3.4 Mở rộng type cast trong payload handler để include `message` field

- [x] **T4 — TypeScript & Lint Validation**
  - [x] T4.1 `npx tsc --noEmit` pass không lỗi

---

## Phạm vi rõ ràng — KHÔNG làm ngoài đây

- ✅ Tab title dynamic với `(N)` prefix
- ✅ Browser Notification API (Notification API — không cần service worker, không cần backend)
- ✅ Opt-in UI trên notifications page
- ✅ Âm thanh thông báo via Web Audio API (programmatic, không cần file .mp3/.wav)
- ❌ **KHÔNG** implement Service Worker Web Push (cần server + VAPID keys — over-engineered cho internal tool)
- ❌ **KHÔNG** thay đổi logic sidebar badge (đã hoạt động đúng ở `app-sidebar.tsx`)
- ❌ **KHÔNG** thêm notification permission prompt auto-popup khi vào app (intrusive UX)
- ❌ **KHÔNG** persist notification permission state (browser tự quản lý)
- ❌ **KHÔNG** thêm toggle bật/tắt âm thanh (KISS — thêm sau nếu cần)
- ❌ **KHÔNG** tạo DB migration (story này thuần frontend)

---

## Technical Requirements

### FEATURE 1: Tab Title với Prefix `(N)`

#### Cơ chế hoạt động

TanStack Router dùng `head()` trong route definitions để set `document.title` qua `<HeadContent />` (đã có trong `__root.tsx`). Tuy nhiên đây là **static** — không thể inject unread count vào `head()`.

**Giải pháp:** Dùng `useEffect` với `setTimeout(0)` trong hook `use-tab-title.ts`:
- `setTimeout(0)` cho phép `HeadContent` update `document.title` trước (micro-task queue)
- Sau đó hook strip prefix cũ và re-apply với count mới
- `pathname` làm dependency để re-run khi navigate

#### `use-tab-title.ts` — Full implementation

```typescript
// src/features/notifications/hooks/use-tab-title.ts
import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'

export function useTabTitle(unreadCount: number) {
  const { pathname } = useLocation()

  useEffect(() => {
    // setTimeout(0): đợi HeadContent (TanStack Router) set title trước
    const timer = setTimeout(() => {
      // Strip existing prefix nếu có: "(3) Title" → "Title"
      const baseTitle = document.title.replace(/^\(\d+\+?\)\s/, '')

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
```

#### Mount trong `AppSidebar`

`AppSidebar` là component lý tưởng nhất:
- Luôn mount khi authenticated (xem `authenticated-layout.tsx`)
- Đã có `unreadCount` từ `useUnreadCount()` (line 36 của `app-sidebar.tsx`)
- Chỉ cần thêm 2 dòng: import + call hook

```typescript
// Thêm import:
import { useTabTitle } from '@/features/notifications/hooks/use-tab-title'

// Thêm sau dòng useNotificationsRealtime (line 37):
useTabTitle(unreadCount)
```

---

### FEATURE 2: Browser Notification API

#### Tại sao dùng Notification API, không dùng Service Worker Web Push?

Đây là **internal tool** với team nhỏ. Notification API (không cần service worker):
- Không cần backend changes
- Không cần VAPID keys
- Không cần migration
- Hoạt động khi tab đang mở (background tab vẫn nhận thông báo)
- Đủ dùng cho use case này — user luôn có tab TekSpace mở khi làm việc

Limitation: không hiển thị khi browser đóng hoàn toàn. Chấp nhận được.

#### `use-browser-notifications.ts` — Full implementation

```typescript
// src/features/notifications/hooks/use-browser-notifications.ts
import { useState, useCallback, useEffect } from 'react'

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied'

export function useBrowserNotifications() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    isSupported ? (Notification.permission as BrowserNotificationPermission) : 'denied'
  )

  // Sync với trạng thái thực tế khi mount (user có thể thay đổi trong browser settings)
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission as BrowserNotificationPermission)
  }, [isSupported])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return
    const result = await Notification.requestPermission()
    setPermission(result as BrowserNotificationPermission)
  }, [isSupported])

  return { isSupported, permission, requestPermission }
}
```

#### Opt-in UI trong `notifications.tsx`

Thêm banner **phía trên** phần header của NotificationsPage. Sử dụng shadcn `Card` hoặc `Alert` component:

```tsx
// Import thêm:
import { useBrowserNotifications } from '@/features/notifications/hooks/use-browser-notifications'
import { BellRing, BellOff } from 'lucide-react'

// Trong NotificationsPage function, thêm:
const { isSupported, permission, requestPermission } = useBrowserNotifications()

// Trong JSX, thêm banner trước header div:
{isSupported && permission === 'default' && (
  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <BellRing className="h-4 w-4 shrink-0" />
      <span>Bật thông báo trình duyệt để nhận cảnh báo khi đang làm việc ở tab khác</span>
    </div>
    <Button variant="outline" size="sm" onClick={() => void requestPermission()}>
      Bật thông báo
    </Button>
  </div>
)}

{isSupported && permission === 'denied' && (
  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
    <BellOff className="h-4 w-4 shrink-0" />
    <span>Thông báo trình duyệt bị chặn. Vào Settings → Site Settings → Notifications để cấp quyền.</span>
  </div>
)}
```

#### Update `use-notifications-realtime.ts` — Thêm browser notification + sound trigger

Đây là thay đổi tối giản nhất — chỉ thêm ~15 dòng code vào handler đã có:

```typescript
// Thêm import ở đầu file:
import { playNotificationSound } from '@/features/notifications/utils/notification-sound'

// Trong payload handler, SAU khi invalidate queries:
(payload) => {
  const row = payload.new as { tenant_id?: string; type?: string; message?: string }
  if (row.tenant_id !== tenantId) return

  queryClient.invalidateQueries({
    queryKey: [QUERY_KEYS.notifications, tenantId],
  })

  // ... existing incident/appeal invalidation logic ...

  // THÊM MỚI: Âm thanh ping — luôn phát khi có notification mới (bất kể tab state)
  playNotificationSound()

  // THÊM MỚI: Browser Notification — chỉ khi granted VÀ tab không active
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState !== 'visible'
  ) {
    const body = row.message ?? 'Bạn có thông báo mới'
    // eslint-disable-next-line no-new
    new Notification('TekSpace', {
      body,
      icon: '/favicon.ico',
    })
  }
},
```

**Lưu ý type cast:** Mở rộng type cast từ `{ tenant_id?: string; type?: string }` sang `{ tenant_id?: string; type?: string; message?: string }`.

---

### FEATURE 3: Notification Sound via Web Audio API

#### Tại sao Web Audio API, không dùng `<audio>` + file MP3?

| | Web Audio API | `<audio>` + file |
|--|---|---|
| File cần thiết | ❌ Không | ✅ Cần .mp3/.wav trong `public/` |
| Bundle size | ✅ 0 bytes | ✅ Nhỏ nhưng cần fetch |
| Customizable | ✅ Programmatic | ❌ Phụ thuộc file |
| Latency | ✅ Gần như 0 | ⚠️ Cần preload |
| Browser support | ✅ 97%+ | ✅ 99%+ |

Web Audio API tạo tiếng "ping" programmatically — không cần file, không cần commit binary.

#### `notification-sound.ts` — Full implementation

```typescript
// src/features/notifications/utils/notification-sound.ts

/**
 * Phát tiếng "ping" ngắn khi có notification mới.
 * Dùng Web Audio API — không cần file âm thanh.
 * Silent fail nếu trình duyệt không hỗ trợ.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Âm thanh "ping": 880Hz → 440Hz trong 0.08s, fade out trong 0.25s
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08)

    gainNode.gain.setValueAtTime(0.25, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.25)

    // Cleanup: đóng AudioContext sau khi âm thanh xong
    oscillator.onended = () => {
      void ctx.close()
    }
  } catch {
    // Silent fail — không block app nếu Web Audio API unavailable
  }
}
```

**Âm thanh design:** 880Hz → 440Hz (A5 → A4), fade out 0.25s — nghe giống tiếng "ping" nhẹ của notification, không chói tai.

**Volume:** `gainNode.gain = 0.25` — vừa đủ nghe, không quá to trong môi trường làm việc.

---

## File Structure — Đúng vị trí, đúng convention

### Files CẦN TẠO MỚI (3 files)

```
src/features/notifications/hooks/use-tab-title.ts                    ← NEW
src/features/notifications/hooks/use-browser-notifications.ts        ← NEW
src/features/notifications/utils/notification-sound.ts               ← NEW (pure utility, không phải hook)
```

### Files CẦN SỬA (3 files)

```
src/components/layout/app-sidebar.tsx                      ← thêm useTabTitle(unreadCount)
src/features/notifications/hooks/use-notifications-realtime.ts ← thêm sound + browser notification trigger
src/routes/_app/notifications.tsx                          ← thêm opt-in UI
```

### Files KHÔNG ĐƯỢC CHẠM

```
src/features/notifications/hooks/use-unread-count.ts       ← GIỮ NGUYÊN (đã hoạt động tốt)
src/features/notifications/hooks/use-mark-read.ts          ← GIỮ NGUYÊN
src/features/notifications/hooks/use-mark-all-read.ts      ← GIỮ NGUYÊN
src/features/notifications/hooks/use-infinite-notifications.ts ← GIỮ NGUYÊN (8-11)
src/features/notifications/hooks/use-notifications.ts      ← GIỮ NGUYÊN
src/features/notifications/services/notifications.service.ts ← GIỮ NGUYÊN
src/components/layout/nav-group.tsx                        ← GIỮ NGUYÊN (sidebar badge đã hoạt động)
src/components/layout/data/sidebar-data.ts                 ← GIỮ NGUYÊN
```

---

## Architecture Compliance

- **Named exports only** — `export function useTabTitle(...)`, không dùng `export default`
- **Components import từ hooks** — `NotificationsPage` import `useBrowserNotifications`
- **`cn()` cho classNames** — không dùng `clsx`/`twMerge` trực tiếp (nếu cần style dynamic)
- **Không tạo barrel exports** (`index.ts`) — import trực tiếp từ file
- **Pattern hiện tại:** `import { useQuery } from '@tanstack/react-query'` (không phải `react-query`)
- **Lucide icons:** `BellRing`, `BellOff` từ `lucide-react` (cùng source với `Bell` đã dùng trong file)

---

## Previous Wave Context (Wave 3 Learnings)

**Từ story 8-11 (infinite-scroll — done):**
- `useUnreadCount` query key: `[QUERY_KEYS.notifications, tenantId, userId, 'unread-count']`
- Realtime invalidation dùng partial key `[QUERY_KEYS.notifications, tenantId]` → tự match `unread-count` subkey
- Khi mark-all-read invalidates notifications → `useUnreadCount` cũng bị invalidate → tab title sẽ tự cập nhật ✅
- Pattern `useEffect` với cleanup: `return () => observer.disconnect()` (tương tự `return () => clearTimeout(timer)`)

**Từ story 8-10 (user-avatar-upload — done):**
- `AppSidebar` đã có nhiều hooks, thêm `useTabTitle` là minimal change

**Từ story 8-9 (highlight-current-timeslot — done):**
- `useLocation()` từ `@tanstack/react-router` là cách standard để watch route changes

**Từ story 8-2 (page-title-fix — done):**
- `HeadContent` đã được render trong `__root.tsx` — route `head()` titles đang hoạt động
- Tất cả 15 routes đã có `head()` định nghĩa sẵn
- Tab title sẽ có format: `"Thông báo — TekSpace"`, `"Team Dashboard — TekSpace"`, etc.
- Sau khi thêm prefix: `"(3) Thông báo — TekSpace"`, `"(3) Team Dashboard — TekSpace"` ✅

---

## Git Intelligence (commits gần nhất)

| Commit | Files liên quan |
|--------|-----------------|
| `b0c4367` feat(8-11): infinite scroll | notifications hooks + components |
| `b195957` chore(8-10): avatar code review | app-sidebar.tsx (profileData) |
| `c8008a3` chore(8-9): timeslot fixes | schedule components |
| `bdfcdd0` fix: error pages + root redirect | `__root.tsx`, route files |
| `eb290d2` chore(8-7): page-container fixes | layout components |

**Patterns hiện tại trong codebase:**
- `useEffect` với cleanup function — pattern chuẩn (xem `use-notifications-realtime.ts`)
- `useLocation()` từ `@tanstack/react-router` — xem `nav-group.tsx` line 38
- `void` prefix cho async calls không cần await — xem `app-sidebar.tsx` line 144
- `typeof window !== 'undefined'` guard cho browser APIs — best practice cho SSR safety

---

## Notes cho Dev Agent

### 1. `setTimeout(0)` trong `use-tab-title.ts` là QUAN TRỌNG
HeadContent (TanStack Router) update `document.title` trong micro-task queue khi route thay đổi. `setTimeout(0)` đặt update của chúng ta vào macro-task queue — đảm bảo HeadContent chạy trước, rồi mới apply prefix. **Không bỏ `setTimeout`**.

### 2. `document.title` strip pattern
Regex `^\(\d+\+?\)\s` match:
- `(3) ` → strip → `Title`
- `(99+) ` → strip → `Title`
- `Title` (không có prefix) → không thay đổi → `Title`

Test regex trước khi dùng: `/^\(\d+\+?\)\s/.test('(3) Thông báo — TekSpace')` → `true`.

### 3. Notification API — `new Notification(...)` không cần `await`
Constructor `new Notification(...)` là synchronous. **KHÔNG** dùng `await`. Tuy nhiên, cần comment `// eslint-disable-next-line no-new` để tránh ESLint warning về `new` không assign.

### 4. `document.visibilityState` check trong realtime hook
Chỉ show browser notification khi tab không active:
```typescript
document.visibilityState !== 'visible'
// 'hidden' = tab không active / minimize
// 'visible' = user đang nhìn vào tab này
```
Không dùng `document.hasFocus()` — ít reliable hơn.

### 5. `favicon.ico` cho notification icon
File `/favicon.ico` đã có trong project root (public folder chứa `images/`). Path `/favicon.ico` hoạt động trực tiếp vì Vite serve static files từ `public/`.

### 6. Không cần thêm `QUERY_KEYS` mới
Story này không tạo query mới — chỉ dùng `useUnreadCount` đã có và hook effect thuần.

### 7. `AppSidebar` là location đúng nhất cho `useTabTitle`
- Mount khi authenticated → tab title logic chỉ active khi user đã login ✅
- Đã có `unreadCount` sẵn → không tạo thêm query ✅
- Không mount ở trang sign-in / create-tenant → title các trang này không bị prefix ✅

### 8. `useBrowserNotifications` — state sync khi mount
`Notification.permission` là giá trị tĩnh (không reactive). Dùng `useState` với giá trị ban đầu từ `Notification.permission`. Nếu user thay đổi trong browser settings và F5, state sẽ được sync lại qua `useEffect` khi mount.

### 9. Web Audio API — `AudioContext` lifecycle
Mỗi lần gọi `playNotificationSound()` tạo một `AudioContext` mới. `oscillator.onended` đóng context sau khi âm thanh xong (`ctx.close()`). Đây là pattern đúng — không giữ context sống mãi vì browser có giới hạn số AudioContext đồng thời.

### 10. Web Audio API — Autoplay Policy
Trình duyệt có thể block `AudioContext` nếu chưa có user interaction. Tuy nhiên, notification sound chỉ phát KHI realtime INSERT xảy ra — và user đã interact với app (đang login, dùng app). `try/catch` trong `playNotificationSound()` sẽ silent fail nếu policy block. Không cần handle thêm.

### 11. `utils/` folder trong features
`notification-sound.ts` đặt tại `src/features/notifications/utils/` (tạo folder mới nếu chưa có). Convention: hooks = React hooks với `use` prefix, utils = pure functions không dùng React APIs. `playNotificationSound()` là pure function → đúng là `utils/`.

---

## Testing Checklist

### Trước khi mark done

- [ ] TypeScript compile không lỗi (`npx tsc --noEmit`)
- [ ] Có 3 unread notifications → tab title hiển thị `(3) <Route Title>`
- [ ] Mark all read → tab title về `<Route Title>` (không có prefix)
- [ ] Navigate từ Notifications sang Dashboard → title update đúng với prefix `(N)`
- [ ] Sidebar badge vẫn hoạt động đúng (số đỏ ở icon Thông báo)
- [ ] Notifications page: banner opt-in hiển thị khi permission `default`
- [ ] Click "Bật thông báo" → browser hỏi permission → nếu grant: banner biến mất
- [ ] Nếu deny: banner đổi sang message hướng dẫn
- [ ] Khi tab ở background + có notification mới → browser notification hiện
- [ ] Khi tab ở foreground → browser notification KHÔNG hiện (chỉ sidebar badge + in-app list)
- [ ] Khi có notification mới → nghe tiếng "ping" (bất kể tab active hay không)
- [ ] Âm thanh đủ nghe nhưng không chói — kiểm tra ở volume máy tính bình thường
- [ ] Mobile (nếu có test): Notification API không support → banner ẩn; Web Audio API vẫn hoạt động trên mobile Chrome

### Không cần test DB
Story này **không có migration** — thuần frontend JavaScript.

---

## Change Log

- 2026-03-25: Story created (Wave 4, Epic 8)
- 2026-03-25: Story implemented — 3 new files, 3 files modified. Tab title prefix (N), browser notification opt-in UI, browser notification trigger + Web Audio ping sound.

---

## Dev Agent Record

### Completion Notes

- **T1 — Tab Title**: Tạo `use-tab-title.ts` dùng `useEffect` + `setTimeout(0)` để đợi HeadContent (TanStack Router) set title trước, sau đó apply prefix `(N)`. Mount trong `AppSidebar` vì đây là component luôn active khi authenticated và đã có `unreadCount`.
- **T2 — Browser Notifications**: Tạo `use-browser-notifications.ts` với lazy `useState` initializer thay vì `useEffect` sync (tránh ESLint `react-hooks/set-state-in-effect`). Opt-in UI thêm vào `notifications.tsx` với banner khi `default`, thông báo hướng dẫn khi `denied`, ẩn khi `granted`.
- **T3 — Sound + Browser Notification trigger**: Tạo `notification-sound.ts` dùng Web Audio API programmatic (880Hz→440Hz ping, fade 0.25s, silent fail). Cập nhật `use-notifications-realtime.ts` — mở rộng type cast thêm `message` field, gọi `playNotificationSound()` bất kể tab state, show `new Notification(...)` chỉ khi granted + tab không visible.
- **T4 — Validation**: `npx tsc --noEmit` pass, ESLint pass (0 errors, 0 warnings).

### Debug Log

- ESLint lỗi `react-hooks/set-state-in-effect` trong `use-browser-notifications.ts` — fix bằng cách đổi sang lazy initializer cho `useState` thay vì `useEffect` sync.
- ESLint warning `Unused eslint-disable directive` cho `no-new` trong `use-notifications-realtime.ts` — remove comment không cần thiết.

### File List (actual)

**Tạo mới:**
- `src/features/notifications/hooks/use-tab-title.ts`
- `src/features/notifications/hooks/use-browser-notifications.ts`
- `src/features/notifications/utils/notification-sound.ts`

**Sửa đổi:**
- `src/components/layout/app-sidebar.tsx`
- `src/features/notifications/hooks/use-notifications-realtime.ts`
- `src/routes/_app/notifications.tsx`
