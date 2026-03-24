# UX Polish Spec — Epic 1 Post-Retro Fixes

**Ngày:** 2026-03-24
**Author:** Sally (UX Designer)
**Scope:** 14 UX issues phát hiện sau retro Epic 1 + 3 bổ sung từ Project Lead
**Prerequisite:** Phải hoàn thành trước khi bắt đầu Epic 2

---

## Tổng quan thay đổi lớn

### IA Restructure (Breaking Change)

Loại bỏ `/settings` layout. Thay bằng 2 khu vực tách biệt:

```
TRƯỚC:                          SAU:
/settings/profile          →    /account/profile   (thông tin cá nhân + timezone)
/settings/profile          →    /account/security  (đổi mật khẩu)
/settings/team (tab Cài đặt) →  /team/settings    (cài đặt nhóm)
/settings/team (tab Thành viên)→ /team/members     (danh sách thành viên)
/settings/team (tab Lời mời)→   /team/invites     (lời mời)
```

### ROUTES mới (src/lib/routes.ts)

```typescript
export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',
  app: {
    createTenant: '/create-tenant',
    dashboard: '/dashboard',
    schedule: '/schedule',
    scheduleManage: '/schedule/manage',
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    // Xóa settings.profile và settings.team
    account: {
      profile: '/account/profile',
      security: '/account/security',
    },
    team: {
      members: '/team/members',
      invites: '/team/invites',
      settings: '/team/settings',
    },
  },
} as const
```

---

## FIX 1 — Create-tenant: Fullscreen onboarding (không có sidebar)

**Vấn đề:** `/create-tenant` render trong `AuthenticatedLayout` → user thấy sidebar đầy đủ trước khi có team.

**File thay đổi:**
- `src/routes/_app/route.tsx`
- `src/routes/_app/create-tenant.tsx`

**Giải pháp:** Tách layout. Khi route là `/create-tenant`, render fullscreen layout thay vì `AuthenticatedLayout`.

**Spec chi tiết:**

Trong `_app/route.tsx`, hàm `AppLayout`, kiểm tra pathname:

```tsx
function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isOnboarding = pathname === ROUTES.app.createTenant

  useEffect(() => { /* session invalidation listener — giữ nguyên */ }, [navigate])

  // Onboarding: fullscreen, không sidebar
  if (isOnboarding) return <Outlet />

  return <AuthenticatedLayout />
}
```

**Layout của create-tenant page** — dùng cùng style với sign-in page:
```tsx
<div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
  <div className='w-full max-w-sm'>
    <div className='mb-8 text-center'>
      <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
      <p className='text-muted-foreground mt-2 text-sm'>Tạo workspace cho team của bạn</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle>Tạo team</CardTitle>
        <CardDescription>Đặt tên cho team workspace của bạn</CardDescription>
      </CardHeader>
      <CardContent>
        {/* CreateTenantForm hiện tại */}
      </CardContent>
    </Card>
  </div>
</div>
```

**Xóa:** Icon `Building2` to ở giữa trang (trông như placeholder). Card đã đủ context.

---

## FIX 2 — Page title metadata toàn app

**Vấn đề:** Browser tab hiện "SpeakPing Admin" (cũ) hoặc thiếu title.

**File thay đổi:** `index.html`, và mỗi route file cần title riêng.

**index.html:**
```html
<title>TekSpace</title>
<meta name="description" content="Team workspace management for modern teams" />
```

**Per-route titles** — thêm vào `head` export của từng route:

| Route | Title |
|-------|-------|
| `/sign-in` | `Đăng nhập — TekSpace` |
| `/forgot-password` | `Quên mật khẩu — TekSpace` |
| `/reset-password` | `Đặt lại mật khẩu — TekSpace` |
| `/accept-invite` | `Tham gia team — TekSpace` |
| `/create-tenant` | `Tạo team — TekSpace` |
| `/dashboard` | `Dashboard — TekSpace` |
| `/account/profile` | `Hồ sơ cá nhân — TekSpace` |
| `/account/security` | `Bảo mật — TekSpace` |
| `/team/members` | `Thành viên — TekSpace` |
| `/team/invites` | `Lời mời — TekSpace` |
| `/team/settings` | `Cài đặt nhóm — TekSpace` |

**Cách implement với TanStack Router:**
```tsx
export const Route = createFileRoute('/sign-in')({
  head: () => ({
    meta: [{ title: 'Đăng nhập — TekSpace' }],
  }),
  // ...
})
```

---

## FIX 3 — IA Restructure: Xóa /settings layout, tạo /account/* và /team/*

**Vấn đề:** Double navigation (sidebar + left panel). `/settings` layout có left nav "Tài khoản / Nhóm" redundant với sidebar.

### 3A — Xóa /settings layout

**Xóa file:** `src/routes/_app/settings/route.tsx` (layout wrapper không cần nữa)
**Xóa file:** `src/routes/_app/settings/profile.tsx` (move sang account/profile + account/security)
**Xóa file:** `src/routes/_app/settings/team.tsx` (move sang team/members + team/invites + team/settings)

### 3B — Tạo route structure mới

```
src/routes/_app/
├── account/
│   ├── route.tsx       ← Layout wrapper đơn giản (page header, max-width container)
│   ├── profile.tsx     ← Thông tin cá nhân + Timezone cá nhân
│   └── security.tsx    ← Đổi mật khẩu + Xóa tài khoản
└── team/
    ├── route.tsx        ← Layout wrapper (page header, guards)
    ├── members.tsx      ← Danh sách thành viên + InviteMemberDialog + RoleActionDropdown
    ├── invites.tsx      ← InviteListSection
    └── settings.tsx     ← Team settings form (timezone, deadlines, committed hours)
```

### 3C — Layout của account/route.tsx

```tsx
// Không có left panel nav — chỉ là container đơn giản
function AccountLayout() {
  return (
    <div className='container mx-auto max-w-2xl py-8'>
      <Outlet />
    </div>
  )
}
```

### 3D — Layout của team/route.tsx

Tương tự AccountLayout. Team pages cần thêm guard:
```tsx
// beforeLoad: nếu không có activeTenantId → redirect createTenant
// (đã có ở _app/route.tsx nhưng team routes cần activeTenantId để query)
```

### 3E — Page structure của /account/profile

```
Hồ sơ cá nhân
├── Section: Thông tin cá nhân
│   ├── Họ và tên (input, editable)
│   └── Email (read-only — từ Supabase Auth, không đổi được)
└── Section: Timezone cá nhân
    ├── TimezoneSelector (đã có sẵn)
    ├── Warning nếu timezone = UTC
    └── Nút "Lưu"
```

### 3F — Page structure của /account/security

```
Bảo mật
├── Section: Đổi mật khẩu
│   └── ChangePasswordForm (đã có sẵn)
└── Section: Xóa tài khoản (danger zone)
    ├── Background đỏ nhạt / border đỏ
    ├── Cảnh báo isSoleOwner
    └── Nút "Xóa tài khoản" (destructive)
```

### 3G — Page structure của /team/members

```
Thành viên — [Tên team]
├── Header: "Thành viên" + nút "Mời thành viên" (Owner/Manager only — <Can>)
└── MemberList (đã có sẵn, full width, không cần tabs)
```

### 3H — Page structure của /team/invites

```
Lời mời — [Tên team]
├── Header: "Lời mời" + nút "Mời thành viên" (Owner/Manager only)
└── InviteListSection (đã có sẵn)
```

### 3I — Page structure của /team/settings

```
Cài đặt nhóm — [Tên team]
├── Permission guard: chỉ Owner thấy form (giữ nguyên logic hiện tại)
└── Team settings form (giữ nguyên)
```

### 3J — Sidebar data update

**File:** `src/components/layout/data/sidebar-data.ts`

Thay section "Settings" bằng:
```typescript
{
  title: 'Team',
  items: [
    {
      title: 'Thành viên',
      url: '/team/members',
      icon: Users,
    },
    {
      title: 'Lời mời',
      url: '/team/invites',
      icon: Mail,  // import Mail from lucide-react
    },
    {
      title: 'Cài đặt nhóm',
      url: '/team/settings',
      icon: Settings,
    },
  ],
},
// Xóa "Profile" và "App Settings" items — Profile move vào NavUser dropdown
// App Settings: bỏ (chưa implement)
```

---

## FIX 4 — Registration: Thêm field "Họ và tên" (full_name)

**Vấn đề:** Form đăng ký chỉ có email + password. Không collect tên → member list hiện email thay tên.

**Files thay đổi:**
- `src/features/auth/schemas/auth.schema.ts`
- `src/features/auth/services/auth.service.ts`
- `src/features/auth/components/RegisterForm.tsx`

**Schema update** — `registerSchema`:
```typescript
export const registerSchema = z.object({
  fullName: z.string().min(2, 'Họ và tên tối thiểu 2 ký tự').max(100).trim(),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
  confirmPassword: z.string(),
}).refine(...)
```

**Service update** — `signUp`:
```typescript
export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },  // Supabase raw_user_meta_data
    },
  })
  if (error) throw error

  // Update users table full_name (trigger hoặc direct update)
  if (data.user) {
    await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', data.user.id)
  }
  return data
}
```

**RegisterForm UI** — thêm field "Họ và tên" ở đầu form, trước Email:
```
[Họ và tên]        ← MỚI, required
[Email]
[Mật khẩu]
[Xác nhận mật khẩu]
[Tạo tài khoản]
```

**Member list fallback** — trong `MemberList` component, nếu `full_name` null/empty:
```typescript
const displayName = member.full_name || member.email.split('@')[0]
```

---

## FIX 5 — Sign-in: Active tab contrast rõ hơn

**Vấn đề:** Tab active/inactive khó phân biệt.

**File:** `src/routes/sign-in.tsx`

**Spec:** Thay shadcn `Tabs` default variant bằng styling rõ hơn. Active tab có:
- Background: `bg-background` (trắng)
- Box shadow: `shadow-sm`
- Text: `text-foreground font-semibold`

Inactive tab:
- Background: transparent
- Text: `text-muted-foreground`

Nếu dùng shadcn `Tabs` component, đây là default behavior của `TabsList` với `TabsTrigger` — kiểm tra xem hiện tại có đang dùng đúng component không. Nếu đang dùng custom button tabs, switch sang shadcn `<Tabs><TabsList><TabsTrigger>` chuẩn.

---

## FIX 6 — Accept-invite: Thêm TekSpace branding

**Vấn đề:** Trang accept-invite thiếu branding, user mới không biết đây là service gì.

**File:** `src/routes/accept-invite.tsx`

**Thêm vào đầu card** (tương tự sign-in layout):
```tsx
<div className='mb-8 text-center'>
  <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
  <p className='text-muted-foreground mt-2 text-sm'>Team workspace management</p>
</div>
```

Layout tổng thể: đổi thành centered fullscreen (giống sign-in page), nếu chưa phải.

---

## FIX 7 — Invite dialog: Truncate URL + fix toast

**Vấn đề:** URL quá dài hiện nguyên trong dialog. Toast "Đã copy" xuất hiện khi dialog vẫn open.

**File:** `src/features/tenant/components/InviteMemberDialog.tsx`

**URL display:**
```tsx
// Thay vì hiện nguyên URL, truncate và style đẹp:
<div className='bg-muted rounded-md p-3 text-sm font-mono break-all'>
  {inviteUrl.length > 60
    ? inviteUrl.slice(0, 40) + '...' + inviteUrl.slice(-15)
    : inviteUrl}
</div>
```

Hoặc đơn giản hơn: chỉ hiện domain + path ngắn:
```tsx
const displayUrl = new URL(inviteUrl)
const shortUrl = `${displayUrl.host}/accept-invite?token=${token.slice(0, 8)}...`
```

**Toast timing:** Chỉ gọi `toast.success("Đã copy link lời mời!")` sau khi user click nút Copy — không gọi lúc dialog mở. Kiểm tra logic hiện tại và đảm bảo toast chỉ fire `onClick`.

---

## FIX 8 — Invite status badges

**Vấn đề:** "Đã chấp nhận" không có visual badge. Inconsistent với "Đang chờ".

**File:** `src/features/tenant/components/InviteListSection.tsx`

**Badge mapping:**
```tsx
const statusConfig = {
  pending:  { label: 'Đang chờ',     variant: 'warning'  },   // orange — đã có
  accepted: { label: 'Đã chấp nhận', variant: 'success'  },   // green — THÊM MỚI
  revoked:  { label: 'Đã thu hồi',   variant: 'secondary'},   // gray
  expired:  { label: 'Đã hết hạn',   variant: 'secondary'},   // gray
}

<Badge variant={statusConfig[invite.status].variant}>
  {statusConfig[invite.status].label}
</Badge>
```

Nếu shadcn `Badge` không có `variant='success'`, thêm custom class:
```tsx
// variant success: bg-green-100 text-green-800 (light mode)
<Badge className='bg-green-100 text-green-800 hover:bg-green-100'>
  Đã chấp nhận
</Badge>
```

---

## FIX 9 — Committed hours: Number input

**Vấn đề:** Field "Giờ cam kết mặc định" dùng text input thay vì number input.

**File:** `src/routes/_app/team/settings.tsx` (sau khi restructure)

**Schema:** `default_committed_hours: z.number().int().min(1).max(168)`

**UI:**
```tsx
<FormField
  name='default_committed_hours'
  render={({ field }) => (
    <FormItem>
      <FormLabel>Giờ cam kết mặc định / tuần</FormLabel>
      <FormControl>
        <Input
          type='number'
          min={1}
          max={168}
          {...field}
          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
        />
      </FormControl>
      <FormDescription>Số giờ làm việc cam kết mỗi tuần (1–168)</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## FIX 11 — User dropdown + Avatar ở bottom sidebar

**Phát hiện:** `NavUser` component (`src/components/layout/nav-user.tsx`) ĐÃ BUILD XONG với đầy đủ dropdown (Profile, Notifications, Sign out), Avatar với initials fallback. Chỉ cần **mount vào AppSidebar**.

**File:** `src/components/layout/app-sidebar.tsx`

**Thay đổi:**
1. Import `NavUser` và `SidebarFooter`
2. Lấy user data từ auth store
3. Mount `<NavUser>` trong `<SidebarFooter>`

```tsx
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { user } = useAuthStore()

  // Build user object cho NavUser
  const navUser = {
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    avatar: '',  // Initials fallback trong NavUser sẽ handle
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher ... />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>  {/* THÊM MỚI */}
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
```

**Update NavUser dropdown items** — đổi links sang ROUTES mới:
```tsx
// Profile → ROUTES.app.account.profile
<DropdownMenuItem onClick={() => navigate({ to: ROUTES.app.account.profile })}>
  <BadgeCheck />
  Hồ sơ cá nhân
</DropdownMenuItem>

// Bỏ Notifications (chưa implement)
// Giữ Sign out
```

**Đổi text sang Tiếng Việt:**
- "Profile" → "Hồ sơ cá nhân"
- "Sign out" → "Đăng xuất"

---

## FIX 12 — Avatar: Initials display trong member list

**NavUser đã có initials avatar.** Cần consistent ở member list.

**File:** `src/features/tenant/components/MemberList.tsx`

Trong mỗi row của member table, thêm Avatar:
```tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// Trong table row:
<TableCell>
  <div className='flex items-center gap-3'>
    <Avatar className='h-8 w-8'>
      <AvatarFallback className='text-xs'>
        {getInitials(member.full_name || member.email)}
      </AvatarFallback>
    </Avatar>
    <div>
      <div className='font-medium'>{member.full_name || member.email.split('@')[0]}</div>
      <div className='text-muted-foreground text-xs'>{member.email}</div>
    </div>
  </div>
</TableCell>
```

Helper function:
```typescript
function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
```

---

## FIX 13 — Team switcher: Kích hoạt "Tạo team mới"

**Phát hiện:** `TeamSwitcher` đã có nút "Add team" (line 97-103 trong team-switcher.tsx) nhưng chưa có `onClick`.

**File:** `src/components/layout/team-switcher.tsx`

**Thay đổi nhỏ:**
```tsx
// Thêm prop onCreateTeam
type TeamSwitcherProps = {
  teams: Team[]
  onSwitch?: (teamId: string) => void
  onCreateTeam?: () => void  // THÊM
}

// Wire vào "Add team" item:
<DropdownMenuItem className='gap-2 p-2' onClick={onCreateTeam}>
  <div className='...'>
    <Plus className='size-4' />
  </div>
  <div className='font-medium text-muted-foreground'>Tạo team mới</div>
</DropdownMenuItem>
```

**Trong AppSidebar**, pass handler:
```tsx
<TeamSwitcher
  teams={teams}
  onSwitch={isSwitching ? undefined : handleSwitch}
  onCreateTeam={() => navigate({ to: ROUTES.app.createTenant })}
/>
```

**Đổi text:** "Add team" → "Tạo team mới"
**Đổi label:** "Teams" → "Danh sách team"

---

## FIX 14 — RoleActionDropdown: Thêm "Hạ xuống Member" cho Manager

**File:** `src/features/tenant/components/RoleActionDropdown.tsx`

**Thêm state và dialog trigger:**
```tsx
const [demoteOpen, setDemoteOpen] = useState(false)

// Logic hiển thị:
const hasDemoteAction = canPromoteMembers && currentRole === 'manager'

// Trong dropdown:
{hasDemoteAction && (
  <DropdownMenuItem onClick={() => setDemoteOpen(true)}>
    Hạ xuống Member
  </DropdownMenuItem>
)}
```

**Tạo DemoteMemberDialog** — `src/features/tenant/components/DemoteMemberDialog.tsx`:

```tsx
// Tương tự PromoteMemberDialog nhưng ngược lại
// Confirm message: "Hạ [name] xuống Member? Họ sẽ mất quyền Manager."
// Gọi: demoteToMember(userId, tenantId) service function
// Toast: "Đã hạ quyền [name] xuống Member."
```

**Service function** — `src/features/tenant/services/tenant.service.ts`:
```typescript
export const demoteToMember = async (userId: string, tenantId: string) => {
  const { error } = await supabase
    .from('tenant_members')
    .update({ role: 'member' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}
```

**Hook** — `src/features/tenant/hooks/use-demote-member.ts`:
```typescript
// useMutation wrap demoteToMember()
// onSuccess: toast.success + invalidate tenantMembers query
```

**Permission check:** `demoteToMember` chỉ Owner được làm — RLS policy `tenant_members` UPDATE đã có `is_tenant_owner()` → không cần thêm DB-level change.

---

## Thứ tự implementation được đề xuất

**Nhóm A — Độc lập, Low effort (làm trước):**
1. FIX 2: Page title metadata (index.html + route heads)
2. FIX 5: Sign-in tab contrast
3. FIX 7: Invite dialog truncate URL + toast fix
4. FIX 8: Invite status badges
5. FIX 9: Committed hours number input
6. FIX 11: Wire NavUser vào AppSidebar (đã có component, chỉ cần mount)
7. FIX 12: Initials avatar trong member list
8. FIX 13: Wire "Tạo team mới" trong TeamSwitcher (1 prop + navigate)
9. FIX 14: Demote Manager → Member

**Nhóm B — Medium effort (làm sau):**
10. FIX 4: Registration + full_name field
11. FIX 6: Accept-invite branding

**Nhóm C — Breaking change, cần làm cuối cùng (IA restructure):**
12. FIX 3: IA restructure (/settings → /account/* + /team/*)
13. FIX 1: Create-tenant fullscreen (phụ thuộc vào FIX 3 hoàn thành)

**Lý do thứ tự:** Nhóm C thay đổi routes và sidebar data — nếu làm trước sẽ break các fixes khác đang reference đường dẫn cũ.

---

## Checklist hoàn thành

- [ ] FIX 1: Create-tenant fullscreen
- [ ] FIX 2: Page titles toàn app
- [ ] FIX 3: IA restructure (/account + /team)
- [ ] FIX 4: Registration full_name field
- [ ] FIX 5: Sign-in tab contrast
- [ ] FIX 6: Accept-invite branding
- [ ] FIX 7: Invite dialog URL + toast
- [ ] FIX 8: Invite status badges
- [ ] FIX 9: Committed hours number input
- [ ] FIX 11: NavUser mounted ở bottom sidebar
- [ ] FIX 12: Avatar initials trong member list
- [ ] FIX 13: "Tạo team mới" trong TeamSwitcher
- [ ] FIX 14: Demote Manager → Member
- [ ] TypeScript: 0 errors (`tsc -b`)
- [ ] Build: success (`vite build`)
- [ ] Lint: 0 errors trên files changed

---

## Notes cho dev agent

### Đừng làm:
- ❌ KHÔNG tạo thêm Supabase client — dùng singleton `supabase-browser.ts`
- ❌ KHÔNG dùng `export default` — named exports
- ❌ KHÔNG hardcode paths — dùng `ROUTES.*`
- ❌ KHÔNG xóa `_app/settings/` folder trước khi tạo xong `/account/` và `/team/` routes (sẽ break app)

### Thứ tự safe khi làm FIX 3:
1. Tạo `/account/` và `/team/` route files mới
2. Cập nhật ROUTES constant
3. Cập nhật sidebar-data.ts
4. Cập nhật NavUser dropdown links
5. Xóa `/settings/` route files
6. Verify `tsc -b` pass
7. Verify `vite build` pass

### Về users.full_name:
- Verify column tồn tại: `mcp: get_table_schema('public.users')`
- Nếu chưa có → tạo migration trước khi code FIX 4
- Supabase trigger `handle_new_user` đã có trong Story 1.1 — check nếu nó đã tự copy `raw_user_meta_data.full_name` sang `users.full_name`

*Generated: 2026-03-24 | Sally (UX Designer) — TekSpace*
