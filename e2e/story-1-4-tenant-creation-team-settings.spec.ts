/**
 * Story 1.4 — Tenant Creation & Team Settings
 * Playwright E2E tests
 *
 * Điều kiện chạy:
 *   - Dev server đang chạy: npm run dev (port 5173)
 *   - Supabase local đang chạy: npx supabase start (port 54321)
 *
 * Strategy mock:
 *   - Auth session: inject vào localStorage (key: sb-127-auth-token) qua page.addInitScript()
 *     TRƯỚC khi page.goto(). Supabase JS đọc session từ localStorage, không phải network.
 *   - Tenant REST API (POST/GET/PATCH): vẫn dùng page.route() vì đây là network call thật.
 *   - refreshSession(): dùng page.route() mock grant_type=refresh_token endpoint.
 *
 * CardTitle trong shadcn/ui render là <div>, không phải <h3>.
 *   → create-tenant: dùng getByText('Tạo team của bạn')
 *   → settings/team: dùng getByRole('heading') vì dùng <h1> thật
 */

import { expect, test } from '@playwright/test'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Supabase JS v2 localStorage key cho local instance (http://127.0.0.1:54321) */
const SUPABASE_STORAGE_KEY = 'sb-127-auth-token'
const TENANT_ID = 'tenant-test-uuid-1234'

// ─── JWT & Session helpers ────────────────────────────────────────────────────

/**
 * Tạo fake JWT với tenant_roles claim.
 * Không cần chữ ký thật — jwtDecode chỉ base64-decode payload, không verify signature.
 * Dùng Node.js Buffer để encode (tránh btoa + manual character replacement).
 */
function makeJwt(tenantRoles: Record<string, string> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-test-123',
      email: 'thangtvb.dev@gmail.com',
      role: 'authenticated',
      tenant_roles: tenantRoles,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url')
  return `${header}.${payload}.fakesig`
}

/**
 * Tạo Supabase session object để lưu vào localStorage.
 */
function makeSession(tenantRoles: Record<string, string> = {}) {
  return {
    access_token: makeJwt(tenantRoles),
    refresh_token: 'fake-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-test-123',
      email: 'thangtvb.dev@gmail.com',
      role: 'authenticated',
    },
  }
}

/**
 * Inject session vào localStorage TRƯỚC khi trang load.
 * PHẢI gọi trước page.goto().
 */
async function injectSession(
  page: import('@playwright/test').Page,
  tenantRoles: Record<string, string> = {}
) {
  const session = makeSession(tenantRoles)
  await page.addInitScript(
    ([key, data]: [string, string]) => {
      localStorage.setItem(key, data)
    },
    [SUPABASE_STORAGE_KEY, JSON.stringify(session)]
  )
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_TENANT_SETTINGS = {
  id: TENANT_ID,
  name: 'Test Team',
  timezone: 'Asia/Ho_Chi_Minh',
  schedule_deadline_day: 0,
  schedule_deadline_hour: 23,
  daily_report_deadline_hour: 3,
  default_committed_hours: 40,
}

/** Mock GET /rest/v1/tenants trả về settings */
async function mockGetTenantSettings(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/tenants**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TENANT_SETTINGS),
      })
    }
    return route.continue()
  })
}

// ─── 1. Redirect guards ───────────────────────────────────────────────────────

test.describe('Redirect guards — _app route', () => {
  test('không có session → redirect về /sign-in', async ({ page }) => {
    // Không inject session → localStorage trống → getSession() null → redirect sign-in
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/sign-in', { timeout: 5000 })
  })

  test('có session nhưng không có tenant → redirect về /create-tenant', async ({ page }) => {
    await injectSession(page, {}) // tenant_roles rỗng
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/create-tenant', { timeout: 5000 })
  })

  test('có session + có tenant → KHÔNG redirect về /create-tenant', async ({ page }) => {
    await injectSession(page, { [TENANT_ID]: 'owner' })
    await mockGetTenantSettings(page)
    await page.goto('/settings/team')
    await expect(page).not.toHaveURL('/create-tenant', { timeout: 5000 })
  })

  test('đang ở /create-tenant với no-tenant session → KHÔNG infinite redirect', async ({
    page,
  }) => {
    await injectSession(page, {}) // no tenant
    await page.goto('/create-tenant')
    await expect(page).toHaveURL('/create-tenant', { timeout: 5000 })
    // CardTitle là <div> → dùng getByText()
    await expect(page.getByText('Tạo team của bạn')).toBeVisible({ timeout: 5000 })
  })
})

// ─── 2. Create Tenant page ────────────────────────────────────────────────────

test.describe('Create Tenant page (/create-tenant)', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, {}) // no tenant
    await page.goto('/create-tenant')
  })

  test('render đúng: icon, tiêu đề, mô tả, form, button', async ({ page }) => {
    // CardTitle là <div> → dùng getByText()
    await expect(page.getByText('Tạo team của bạn')).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/tên team/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /tạo team/i })).toBeVisible()
  })

  test('validate: tên team rỗng → inline error', async ({ page }) => {
    await page.getByRole('button', { name: /tạo team/i }).click()
    await expect(page.getByText(/tối thiểu 2 ký tự/i)).toBeVisible()
  })

  test('validate: tên team 1 ký tự → inline error "tối thiểu 2 ký tự"', async ({ page }) => {
    await page.getByLabel(/tên team/i).fill('A')
    await page.getByRole('button', { name: /tạo team/i }).click()
    await expect(page.getByText(/tối thiểu 2 ký tự/i)).toBeVisible()
  })

  test('validate: tên team > 100 ký tự → inline error "tối đa 100 ký tự"', async ({ page }) => {
    await page.getByLabel(/tên team/i).fill('A'.repeat(101))
    await page.getByRole('button', { name: /tạo team/i }).click()
    await expect(page.getByText(/tối đa 100 ký tự/i)).toBeVisible()
  })

  test('submit thành công → navigate về /settings/team', async ({ page }) => {
    const TOKEN_AFTER_CREATE = makeJwt({ [TENANT_ID]: 'owner' })

    await page.route('**/rest/v1/tenants**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: TENANT_ID, name: 'My Test Team' }),
        })
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      return route.continue()
    })

    // refreshSession() gọi network → mock để trả về JWT mới có tenant_roles
    // Supabase auth-js v2 yêu cầu response có đủ fields: expires_in, token_type, user (đầy đủ)
    await page.route('**/auth/v1/token?grant_type=refresh_token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: TOKEN_AFTER_CREATE,
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: 'user-test-123',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'thangtvb.dev@gmail.com',
            email_confirmed_at: '2026-01-01T00:00:00.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: { email: 'thangtvb.dev@gmail.com', email_verified: true },
          },
        }),
      })
    )

    await page.getByLabel(/tên team/i).fill('My Test Team')
    await page.getByRole('button', { name: /tạo team/i }).click()

    await expect(page).toHaveURL('/settings/team', { timeout: 10000 })
  })

  test('server error khi tạo tenant → toast.error hiển thị', async ({ page }) => {
    await page.route('**/rest/v1/tenants**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        })
      }
      return route.continue()
    })

    await page.getByLabel(/tên team/i).fill('My Team')
    await page.getByRole('button', { name: /tạo team/i }).click()

    await expect(page.getByText(/không thể tạo team/i)).toBeVisible({ timeout: 5000 })
  })

  test('button bị disabled và hiện "Đang tạo..." khi đang submit', async ({ page }) => {
    await page.route('**/rest/v1/tenants**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'error' }),
      })
    })

    await page.getByLabel(/tên team/i).fill('My Team')
    await page.getByRole('button', { name: /tạo team/i }).click()

    await expect(page.getByRole('button', { name: /đang tạo/i })).toBeDisabled({ timeout: 2000 })
  })
})

// ─── 3. Team Settings page ────────────────────────────────────────────────────

test.describe('Team Settings page (/settings/team) — Owner', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, { [TENANT_ID]: 'owner' })
    await mockGetTenantSettings(page)
  })

  test('render đúng: tiêu đề, 5 form fields, button Lưu cài đặt', async ({ page }) => {
    await page.goto('/settings/team')
    // settings/team dùng <h1> thật → getByRole('heading') OK
    await expect(page.getByRole('heading', { name: /cài đặt nhóm/i })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByLabel(/timezone/i)).toBeVisible()
    await expect(page.getByLabel(/ngày deadline nộp lịch/i)).toBeVisible()
    await expect(page.getByLabel(/giờ deadline nộp lịch/i)).toBeVisible()
    await expect(page.getByLabel(/giờ deadline báo cáo ngày/i)).toBeVisible()
    await expect(page.getByLabel(/giờ cam kết mặc định/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /lưu cài đặt/i })).toBeVisible()
  })

  test('form load đúng settings từ DB (timezone, hours, days)', async ({ page }) => {
    await page.goto('/settings/team')
    // Chờ heading xuất hiện (tức là settings đã load và values prop sync vào form)
    await expect(page.getByRole('heading', { name: /cài đặt nhóm.*test team/i })).toBeVisible({
      timeout: 5000,
    })
    // Timezone Select trigger hiển thị "Hồ Chí Minh" khi field.value = 'Asia/Ho_Chi_Minh'
    // Dùng combobox để tránh trùng với hidden <option> element của Radix UI
    await expect(page.getByRole('combobox', { name: /timezone/i })).toContainText(/hồ chí minh/i, {
      timeout: 5000,
    })
    const hoursInput = page.getByLabel(/giờ cam kết mặc định/i)
    await expect(hoursInput).toHaveValue('40', { timeout: 5000 })
  })

  test('lưu cài đặt thành công → toast.success "Đã lưu cài đặt nhóm"', async ({ page }) => {
    await page.route('**/rest/v1/tenants**', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      return route.continue()
    })

    await page.goto('/settings/team')
    // Chờ form.reset() chạy xong: default_committed_hours = 40 (từ useEffect([settings]))
    await expect(page.getByLabel(/giờ cam kết mặc định/i)).toHaveValue('40', { timeout: 5000 })
    await page.getByRole('button', { name: /lưu cài đặt/i }).click()
    await expect(page.getByText(/đã lưu cài đặt nhóm/i)).toBeVisible({ timeout: 5000 })
  })

  test('lưu cài đặt thất bại → toast.error "Không thể lưu cài đặt"', async ({ page }) => {
    await page.route('**/rest/v1/tenants**', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'server error' }),
        })
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      return route.continue()
    })

    await page.goto('/settings/team')
    // Chờ form.reset() chạy xong: default_committed_hours = 40
    await expect(page.getByLabel(/giờ cam kết mặc định/i)).toHaveValue('40', { timeout: 5000 })
    await page.getByRole('button', { name: /lưu cài đặt/i }).click()
    await expect(page.getByText(/không thể lưu cài đặt/i)).toBeVisible({ timeout: 5000 })
  })

  test('validate: default_committed_hours < 1 → inline error "Tối thiểu 1 giờ"', async ({
    page,
  }) => {
    await page.goto('/settings/team')
    // Chờ form.reset() chạy xong: default_committed_hours = 40
    const hoursInput = page.getByLabel(/giờ cam kết mặc định/i)
    await expect(hoursInput).toHaveValue('40', { timeout: 5000 })

    await hoursInput.clear()
    await hoursInput.fill('0')
    await page.getByRole('button', { name: /lưu cài đặt/i }).click()
    await expect(page.getByText(/tối thiểu 1 giờ/i)).toBeVisible()
  })

  test('validate: default_committed_hours > 168 → inline error "Tối đa 168 giờ"', async ({
    page,
  }) => {
    await page.goto('/settings/team')
    // Chờ form.reset() chạy xong: default_committed_hours = 40
    const hoursInput = page.getByLabel(/giờ cam kết mặc định/i)
    await expect(hoursInput).toHaveValue('40', { timeout: 5000 })

    await hoursInput.clear()
    await hoursInput.fill('200')
    await page.getByRole('button', { name: /lưu cài đặt/i }).click()
    await expect(page.getByText(/tối đa 168 giờ/i)).toBeVisible()
  })

  test('button "Đang lưu..." disabled khi đang submit', async ({ page }) => {
    await page.route('**/rest/v1/tenants**', async (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TENANT_SETTINGS),
        })
      }
      return route.continue()
    })

    await page.goto('/settings/team')
    await expect(page.getByRole('button', { name: /lưu cài đặt/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /lưu cài đặt/i }).click()
    await expect(page.getByRole('button', { name: /đang lưu/i })).toBeDisabled({ timeout: 2000 })
  })
})

// ─── 4. Permission guard — Non-owner ─────────────────────────────────────────

test.describe('Team Settings — Non-owner permission guard', () => {
  test('non-owner thấy message read-only, không thấy form', async ({ page }) => {
    await injectSession(page, { [TENANT_ID]: 'member' })
    await page.goto('/settings/team')

    await expect(page.getByText(/chỉ owner mới có thể thay đổi cài đặt nhóm/i)).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByRole('button', { name: /lưu cài đặt/i })).not.toBeVisible()
    await expect(page.getByLabel(/timezone/i)).not.toBeVisible()
  })
})

// ─── 5. Story 1-3 regression — settings/team placeholder đã bị thay thế ─────

test.describe('Regression — Story 1-3', () => {
  test('settings/team KHÔNG còn hiện placeholder "đang phát triển"', async ({ page }) => {
    await injectSession(page, { [TENANT_ID]: 'owner' })
    await mockGetTenantSettings(page)
    await page.goto('/settings/team')

    await expect(page.getByText(/tính năng đang phát triển/i)).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/story 1\.4/i)).not.toBeVisible()
  })
})
