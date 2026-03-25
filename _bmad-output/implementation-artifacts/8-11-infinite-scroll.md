# Story 8-11: Infinite Scroll

**Story ID:** 8.11
**Story Key:** 8-11-infinite-scroll
**Epic:** 8 — UX Polish & Feature Completeness
**Wave:** Wave 3 (sau Wave 2 hoàn thành)
**Status:** review
**Created:** 2026-03-25

---

## Tasks/Subtasks

- [x] **T1 — Service Layer: Thêm paginated functions**
  - [x] T1.1 Thêm `getNotificationsPaged()` vào `notifications.service.ts`
  - [x] T1.2 Thêm `getIncidentsPaged()` vào `incident.service.ts`
  - [x] T1.3 Thêm `getAllReportsPaged()` vào `daily-report.service.ts`

- [x] **T2 — New Hooks: useInfiniteQuery**
  - [x] T2.1 Tạo `use-infinite-notifications.ts`
  - [x] T2.2 Tạo `use-infinite-incidents.ts`
  - [x] T2.3 Tạo `use-infinite-reports.ts`

- [x] **T3 — Component Updates: thêm sentinel + props**
  - [x] T3.1 Cập nhật `NotificationList.tsx` — thêm infinite scroll props + sentinel
  - [x] T3.2 Cập nhật `IncidentList.tsx` — thêm infinite scroll props + sentinel
  - [x] T3.3 Cập nhật `ReportHistoryList.tsx` — thêm infinite scroll props + sentinel

- [x] **T4 — Route Updates: switch sang infinite hooks**
  - [x] T4.1 Cập nhật `notifications.tsx` — dùng `useInfiniteNotifications`
  - [x] T4.2 Cập nhật `incidents/index.tsx` — dùng `useInfiniteIncidents`
  - [x] T4.3 Cập nhật `daily-report.tsx` — dùng `useInfiniteReports` cho history tab

- [x] **T5 — TypeScript & Lint Validation**
  - [x] T5.1 `npx tsc --noEmit` pass không lỗi

---

## Dev Agent Record

### Implementation Plan
- Service layer: Thêm `*Paged` functions dùng Supabase `.range(from, to)` vào 3 services
- New hooks: 3 hooks `useInfiniteQuery` (TanStack Query v5) với `initialPageParam: 0`, `PAGE_SIZE=20`
- Component updates: Thêm IntersectionObserver sentinel vào 3 components (NotificationList, IncidentList, ReportHistoryList)
- Route updates: Switch 3 routes sang infinite hooks, dùng `data.pages.flatMap()` để flatten data

### Debug Log
- TypeScript pass không lỗi sau khi implement đầy đủ

### Completion Notes
✅ Tất cả 5 tasks hoàn thành. Đã implement:
- 3 service functions paginated (offset-based, `.range()`)
- 3 hooks `useInfiniteQuery` (v5 API với `initialPageParam`)
- 3 components cập nhật với sentinel + IntersectionObserver (rootMargin: 200px)
- 3 routes switch sang infinite hooks
- Realtime: partial key matching tự động hoạt động, không cần thay đổi
- TypeScript: 0 lỗi

---

## File List

**Tạo mới:**
- `src/features/notifications/hooks/use-infinite-notifications.ts`
- `src/features/incidents/hooks/use-infinite-incidents.ts`
- `src/features/daily-report/hooks/use-infinite-reports.ts`

**Sửa đổi:**
- `src/features/notifications/services/notifications.service.ts` — thêm `getNotificationsPaged()`
- `src/features/incidents/services/incident.service.ts` — thêm `getIncidentsPaged()`
- `src/features/daily-report/services/daily-report.service.ts` — thêm `getAllReportsPaged()`
- `src/features/notifications/components/NotificationList.tsx` — thêm sentinel + infinite props
- `src/features/incidents/components/IncidentList.tsx` — thêm sentinel + infinite props
- `src/features/daily-report/components/ReportHistoryList.tsx` — thêm sentinel + infinite props
- `src/routes/_app/notifications.tsx` — switch sang `useInfiniteNotifications`
- `src/routes/_app/incidents/index.tsx` — switch sang `useInfiniteIncidents`
- `src/routes/_app/daily-report.tsx` — switch sang `useInfiniteReports` (history tab)

---

## Change Log

- 2026-03-25: Implement infinite scroll cho notifications, incidents, report history. Thêm 3 paged service functions, 3 `useInfiniteQuery` hooks, cập nhật 3 components với IntersectionObserver sentinel, switch 3 route files sang infinite hooks.

---

---

## User Story

> Là một người dùng, tôi muốn danh sách thông báo, incidents và lịch sử report tự động load thêm khi cuộn xuống cuối trang, để không phải bấm pagination hay nhìn toàn bộ data một lần.

---

## Acceptance Criteria

- **AC1:** Trang Notifications load 20 item đầu; cuộn đến sentinel → load thêm 20. Không flash skeleton toàn trang khi load thêm — chỉ spinner nhỏ ở cuối list.
- **AC2:** Khi hết data, sentinel không trigger thêm request. Hiển thị message "Đã tải hết thông báo" hoặc ẩn spinner.
- **AC3:** Trang Incidents (index.tsx) áp dụng infinite scroll tương tự — load 20/page. Client-side filter vẫn hoạt động trên data đã load.
- **AC4:** Tab "Lịch sử" trong daily-report.tsx dùng infinite scroll thay vì `.limit(365)`.
- **AC5:** Realtime notifications (INSERT) vẫn hoạt động đúng sau khi đổi sang `useInfiniteQuery` — item mới xuất hiện không cần F5.
- **AC6:** Không có regression: mark-as-read, mark-all-read, tạo incident, submit appeal vẫn hoạt động bình thường.
- **AC7:** TypeScript không có lỗi. ESLint pass.

---

## Scope rõ ràng — KHÔNG làm ngoài phạm vi này

- ✅ Notifications page
- ✅ Incidents page (index.tsx)
- ✅ Daily Report history tab (`ReportHistoryList`)
- ❌ **KHÔNG** làm server-side filtering cho incidents (giữ nguyên client-side filter)
- ❌ **KHÔNG** thay đổi `use-notifications-realtime.ts` (xem lý do bên dưới)
- ❌ **KHÔNG** thay đổi logic mark-read / mark-all-read / create-incident / submit-appeal
- ❌ **KHÔNG** dụng pagination component TanStack Table (đây là infinite scroll, không phải table pagination)

---

## Technical Requirements

### PAGE_SIZE

```typescript
const PAGE_SIZE = 20  // Dùng cho cả 3 features
```

### TanStack Query v5 — `useInfiniteQuery` API

Dự án dùng **TanStack Query v5**. API v5 khác v4 ở các điểm sau:

```typescript
// v5 — initialPageParam BẮT BUỘC
useInfiniteQuery({
  queryKey: [...],
  queryFn: ({ pageParam }) => ServiceFn(pageParam),
  initialPageParam: 0,                      // ← BẮT BUỘC trong v5
  getNextPageParam: (lastPage, _allPages, lastPageParam) => {
    if (lastPage.length < PAGE_SIZE) return undefined  // hết data
    return lastPageParam + PAGE_SIZE
  },
  staleTime: 30_000,
  enabled: !!tenantId,
})
```

`data.pages` là `T[][]` — phải `flatMap` khi dùng trong component:
```typescript
const items = useMemo(() => data?.pages.flatMap(p => p) ?? [], [data?.pages])
```

### Supabase Offset Pagination

Dùng `.range(from, to)` — **offset-based**, đơn giản, đủ dùng cho internal tool:

```typescript
// from = pageParam (0, 20, 40, ...)
// to = pageParam + PAGE_SIZE - 1
.range(pageParam, pageParam + PAGE_SIZE - 1)
```

Không dùng cursor-based (không cần thiết với data size này).

### IntersectionObserver Pattern

Thêm sentinel `<div ref={sentinelRef} />` vào cuối list. Observer trigger `onLoadMore` khi sentinel đi vào viewport:

```typescript
// Trong component (NotificationList, IncidentList, ReportHistoryList)
const sentinelRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const el = sentinelRef.current
  if (!el) return
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore()
      }
    },
    { rootMargin: '200px' }  // pre-load 200px trước khi user scroll đến cuối
  )
  observer.observe(el)
  return () => observer.disconnect()
}, [hasNextPage, isFetchingNextPage, onLoadMore])
```

**rootMargin: '200px'** — trigger sớm trước khi scroll đến đáy để trải nghiệm mượt mà.

---

## File Structure — Đúng vị trí, đúng convention

### Files CẦN TẠO MỚI (3 hooks)

```
src/features/notifications/hooks/use-infinite-notifications.ts   ← NEW
src/features/incidents/hooks/use-infinite-incidents.ts           ← NEW
src/features/daily-report/hooks/use-infinite-reports.ts          ← NEW
```

### Files CẦN SỬA (service + component + route)

```
src/features/notifications/services/notifications.service.ts     ← thêm getNotificationsPaged()
src/features/incidents/services/incident.service.ts              ← thêm getIncidentsPaged()
src/features/daily-report/services/daily-report.service.ts       ← thêm getAllReportsPaged()

src/features/notifications/components/NotificationList.tsx       ← thêm sentinel + props
src/features/incidents/components/IncidentList.tsx               ← thêm sentinel + props
src/features/daily-report/components/ReportHistoryList.tsx       ← thêm sentinel + props

src/routes/_app/notifications.tsx                                ← switch sang infinite hook
src/routes/_app/incidents/index.tsx                              ← switch sang infinite hook
src/routes/_app/daily-report.tsx                                 ← switch sang infinite hook (history tab)
```

### Files KHÔNG ĐƯỢC CHẠM (quan trọng — tránh regression)

```
src/features/notifications/hooks/use-notifications.ts            ← GIỮ NGUYÊN (dùng ở nơi khác)
src/features/notifications/hooks/use-notifications-realtime.ts   ← GIỮ NGUYÊN (xem lý do)
src/features/notifications/hooks/use-mark-read.ts                ← GIỮ NGUYÊN
src/features/notifications/hooks/use-mark-all-read.ts            ← GIỮ NGUYÊN
src/features/notifications/hooks/use-unread-count.ts             ← GIỮ NGUYÊN
src/features/incidents/hooks/use-incidents.ts                    ← GIỮ NGUYÊN (có thể dùng nơi khác)
src/features/daily-report/hooks/use-all-reports.ts               ← GIỮ NGUYÊN
```

---

## Architecture Compliance

- **Named exports only** — không dùng `export default`
- **Components import từ hooks, KHÔNG import service trực tiếp**
- **Hooks wrap services với `useInfiniteQuery`** — pattern giống `useQuery` hiện tại
- **`cn()` cho classNames** — không dùng `clsx`/`twMerge` trực tiếp
- **Không tạo barrel exports** (`index.ts`) — import trực tiếp từ file

---

## Implementation Chi Tiết

### BƯỚC 1 — Service Layer: Thêm paginated functions

#### `notifications.service.ts` — Thêm 1 function mới (KHÔNG xóa `getNotifications` cũ)

```typescript
getNotificationsPaged: async (
  tenantId: string,
  userId: string,
  from: number,
  to: number
): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return data ?? []
},
```

#### `incident.service.ts` — Thêm 1 function mới (KHÔNG xóa `getIncidents` cũ)

```typescript
getIncidentsPaged: async (
  tenantId: string,
  from: number,
  to: number
): Promise<Incident[]> => {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return data ?? []
},
```

#### `daily-report.service.ts` — Thêm 1 function mới (KHÔNG xóa `getAllReports` cũ)

```typescript
getAllReportsPaged: async (
  tenantId: string,
  userId: string,
  from: number,
  to: number
): Promise<DailyReport[]> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, updated_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('report_date', { ascending: false })
    .range(from, to)
  if (error) throw error
  return (data ?? []) as DailyReport[]
},
```

---

### BƯỚC 2 — New Hooks

#### `use-infinite-notifications.ts`

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { NotificationsService } from '@/features/notifications/services/notifications.service'

const PAGE_SIZE = 20

export function useInfiniteNotifications(tenantId: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.notifications, tenantId, userId, 'infinite'],
    queryFn: ({ pageParam }) =>
      NotificationsService.getNotificationsPaged(tenantId!, userId!, pageParam, pageParam + PAGE_SIZE - 1),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 30_000,
    enabled: !!tenantId && !!userId,
  })
}
```

#### `use-infinite-incidents.ts`

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { IncidentService } from '@/features/incidents/services/incident.service'

const PAGE_SIZE = 20

export function useInfiniteIncidents(tenantId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.incidents, tenantId, 'infinite'],
    queryFn: ({ pageParam }) =>
      IncidentService.getIncidentsPaged(tenantId!, pageParam, pageParam + PAGE_SIZE - 1),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled: !!tenantId,
  })
}
```

#### `use-infinite-reports.ts`

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

const PAGE_SIZE = 20

export function useInfiniteReports(tenantId: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, type: 'history-infinite' }],
    queryFn: ({ pageParam }) =>
      DailyReportService.getAllReportsPaged(tenantId!, userId!, pageParam, pageParam + PAGE_SIZE - 1),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPageParam + PAGE_SIZE
    },
    staleTime: 60_000,
    enabled: !!tenantId && !!userId,
  })
}
```

---

### BƯỚC 3 — Component Props + Sentinel

#### `NotificationList.tsx` — Thêm props + sentinel

**Props mới cần thêm:**

```typescript
type NotificationListProps = {
  notifications: Notification[]
  userTimezone: string | null
  isLoading: boolean
  onMarkRead: (id: string) => void
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}
```

**Thêm vào cuối `<div className="space-y-1">` (sau map notifications):**

```tsx
// Sentinel + loading indicator — thêm sau danh sách notification items
const sentinelRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const el = sentinelRef.current
  if (!el || !onLoadMore) return
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore()
      }
    },
    { rootMargin: '200px' }
  )
  observer.observe(el)
  return () => observer.disconnect()
}, [hasNextPage, isFetchingNextPage, onLoadMore])

// Thêm vào JSX cuối list:
<div ref={sentinelRef} className="py-2 flex justify-center">
  {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
  {!hasNextPage && notifications.length > 0 && (
    <p className="text-xs text-muted-foreground">Đã tải hết thông báo</p>
  )}
</div>
```

Import cần thêm: `useRef, useEffect` từ `react`; `Loader2` từ `lucide-react`.

#### `IncidentList.tsx` — Thêm props + sentinel tương tự

**Props mới thêm vào interface `IncidentListProps`:**

```typescript
hasNextPage?: boolean
isFetchingNextPage?: boolean
onLoadMore?: () => void
```

**Pattern sentinel giống hệt NotificationList** — thêm `sentinelRef`, `useEffect`, và sentinel div ở cuối list.

**Message cuối list cho incidents:**
```tsx
{!hasNextPage && incidents.length > 0 && (
  <p className="text-xs text-muted-foreground text-center py-2">Đã tải hết incidents</p>
)}
```

#### `ReportHistoryList.tsx` — Thêm props + sentinel tương tự

**Props mới thêm vào type `Props`:**

```typescript
hasNextPage?: boolean
isFetchingNextPage?: boolean
onLoadMore?: () => void
```

**Pattern sentinel giống hệt hai component trên.**

**Message cuối list:**
```tsx
{!hasNextPage && reports.length > 0 && (
  <p className="text-xs text-muted-foreground text-center py-2">Đã tải hết lịch sử</p>
)}
```

---

### BƯỚC 4 — Route Files

#### `notifications.tsx` — Switch sang infinite hook

```typescript
// Thay dòng:
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
// Thành:
import { useInfiniteNotifications } from '@/features/notifications/hooks/use-infinite-notifications'

// Thay block useNotifications:
const {
  data: notificationsData,
  isLoading,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteNotifications(activeTenantId, user?.id ?? null)

const notifications = useMemo(
  () => notificationsData?.pages.flatMap((p) => p) ?? [],
  [notificationsData?.pages]
)

// Trong JSX, thêm props vào NotificationList:
<NotificationList
  notifications={notifications}
  userTimezone={timezone}
  isLoading={isLoading}
  onMarkRead={(id) => markRead.mutate(id)}
  hasNextPage={hasNextPage}
  isFetchingNextPage={isFetchingNextPage}
  onLoadMore={fetchNextPage}
/>
```

⚠️ **KHÔNG xóa** các hook khác: `useUnreadCount`, `useMarkRead`, `useMarkAllRead` vẫn giữ nguyên.

#### `incidents/index.tsx` — Switch sang infinite hook

```typescript
// Thay:
import { useIncidents } from '@/features/incidents/hooks/use-incidents'
// Thành:
import { useInfiniteIncidents } from '@/features/incidents/hooks/use-infinite-incidents'

// Thay block useIncidents:
const {
  data: incidentsData,
  isLoading: isIncidentsLoading,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteIncidents(activeTenantId)

const allIncidents = useMemo(
  () => incidentsData?.pages.flatMap((p) => p) ?? [],
  [incidentsData?.pages]
)

// Client-side filter VẪN GIỮ NGUYÊN — chỉ đổi source từ `incidents` → `allIncidents`
const filteredIncidents = useMemo(() => {
  if (!canCreateIncident) return allIncidents
  // ... giữ nguyên filter logic, chỉ thay `incidents` → `allIncidents`
}, [allIncidents, ...])

// Trong JSX, thêm props vào IncidentList:
<IncidentList
  incidents={filteredIncidents}
  isLoading={isIncidentsLoading}
  members={members}
  userTimezone={timezone}
  appeals={appeals}
  canAppeal={!canCreateIncident}
  onAppeal={(incidentId) => setAppealIncidentId(incidentId)}
  onViewDetail={(incidentId) => navigate({ to: '/incidents/$incidentId', params: { incidentId } })}
  hasNextPage={hasNextPage}
  isFetchingNextPage={isFetchingNextPage}
  onLoadMore={fetchNextPage}
/>
```

#### `daily-report.tsx` — Switch sang infinite hook cho history tab

```typescript
// Thay:
import { useAllReports } from '@/features/daily-report/hooks/use-all-reports'
// Thành:
import { useInfiniteReports } from '@/features/daily-report/hooks/use-infinite-reports'

// Thay block useAllReports:
const {
  data: allReportsData,
  isLoading: isHistoryLoading,
  fetchNextPage: fetchNextReportsPage,
  hasNextPage: hasNextReportsPage,
  isFetchingNextPage: isFetchingNextReportsPage,
} = useInfiniteReports(activeTenantId, user?.id ?? null)

const allReports = useMemo(
  () => allReportsData?.pages.flatMap((p) => p) ?? [],
  [allReportsData?.pages]
)

// Trong TabsContent history, thêm props vào ReportHistoryList:
<ReportHistoryList
  reports={allReports}
  timezone={timezone}
  isLoading={isHistoryLoading}
  hasNextPage={hasNextReportsPage}
  isFetchingNextPage={isFetchingNextReportsPage}
  onLoadMore={fetchNextReportsPage}
/>
```

---

## Vì Sao KHÔNG Đổi `use-notifications-realtime.ts`

Hook hiện tại invalidate:
```typescript
queryClient.invalidateQueries({
  queryKey: [QUERY_KEYS.notifications, tenantId],  // 2-element partial key
})
```

TanStack Query v5 dùng **partial key matching** — key `['notifications', tenantId]` sẽ match cả:
- `['notifications', tenantId, userId]` (query cũ)
- `['notifications', tenantId, userId, 'infinite']` (query mới)

→ Realtime notification insert **tự động invalidate infinite query** mà không cần thay đổi gì.

Tương tự, incident realtime invalidation `[QUERY_KEYS.incidents, tenantId]` match `[QUERY_KEYS.incidents, tenantId, 'infinite']`.

---

## Client-Side Filter + Infinite Scroll (Incidents)

**Đây là known limitation — chấp nhận được cho internal tool:**

Khi filter đang active, chỉ filter trên data đã load. Nếu page 1 (20 incidents) sau khi filter chỉ còn 3 kết quả, cần scroll để load page 2.

**KHÔNG cần** thay đổi UX cho trường hợp này trong story này. Đây là accepted trade-off.

---

## Previous Wave Context

**Wave 2 đã hoàn thành:**
- `8-6`: URL restructure + `PageContainer` đã có — tất cả routes dùng `PageContainer`
- `8-7`: `PageContainer` đã exist tại `src/components/layout/page-container.tsx`
- `8-8`: Sidebar collapse fix — `nav-group.tsx` đã sửa

**Pattern từ Wave 2 cần follow:**
- Tất cả pages bọc bằng `PageContainer` ✅ (notifications.tsx và incidents/index.tsx đã có)
- Named exports ✅
- `cn()` cho classNames ✅

---

## Git Intelligence (5 commits gần nhất)

| Commit | Files liên quan |
|--------|-----------------|
| `bdfcdd0` feat(8-19): error pages + root redirect | route files |
| `eb290d2` chore(8-7): code review fixes | layout/page-container |
| `d569217` chore(8-6): code review fixes | routes + sidebar-data |
| `e465736` feat(8-8): sidebar collapse fix | nav-group.tsx |
| `239b1eb` feat(8-5): committed hours history | migration + analytics |

**Patterns từ code hiện tại:**
- TanStack Query v5 đang được dùng (`useQuery`, `useMutation`)
- `useMemo` để derive data từ query results
- `useEffect` trong hooks cho side effects
- Imports từ `@tanstack/react-query` (không phải `react-query`)

---

## Testing Checklist

### Trước khi mark done

- [ ] TypeScript compile không lỗi (`npx tsc --noEmit`)
- [ ] Notifications page: scroll xuống cuối → load thêm items
- [ ] Notifications page: khi hết data → hiển thị "Đã tải hết thông báo"
- [ ] Notifications realtime: tạo notification mới (qua trang khác) → xuất hiện không cần F5
- [ ] Mark-as-read vẫn hoạt động sau infinite scroll
- [ ] Mark-all-read vẫn hoạt động
- [ ] Incidents page: scroll xuống cuối → load thêm incidents
- [ ] Incidents page: filter vẫn hoạt động trên data đã load
- [ ] Incidents page: tạo incident mới → xuất hiện trong list (realtime)
- [ ] Daily report history tab: scroll xuống cuối → load thêm reports
- [ ] Daily report: submit/update report không bị ảnh hưởng (tab "Hôm nay")
- [ ] Mobile: sentinel hoạt động bình thường trên màn hình nhỏ

### Không cần test DB (không có migration)

Story này **không có migration** — chỉ thay đổi frontend query pattern.

---

## Notes cho Dev Agent

1. **Import `useRef` và `useEffect`** vào các component nếu chưa có — đây là React built-in, không cần install gì thêm.

2. **`Loader2` từ `lucide-react`** — đã có trong project (dùng ở nhiều nơi khác).

3. **`useMemo` cho `data?.pages.flatMap`** — PHẢI wrap trong `useMemo` để tránh re-render không cần thiết. Dependency array là `[data?.pages]`.

4. **`hasNextPage` là `boolean | undefined`** trong TanStack Query v5 — dùng `!!hasNextPage` hoặc `hasNextPage ?? false` khi cần boolean.

5. **Không đổi query key cũ** của `use-notifications.ts` và `use-incidents.ts` — các hooks cũ vẫn tồn tại song song, chỉ routes mới dùng hooks infinite.

6. **Kiểm tra `daily-report.tsx` line ~25** để tìm import `useAllReports` và thay thế. File này 493 lines — cẩn thận không xóa các state/logic khác.

7. **`onLoadMore` prop là optional** (`onLoadMore?: () => void`) — các component giữ backwards compatibility khi không truyền prop này.
