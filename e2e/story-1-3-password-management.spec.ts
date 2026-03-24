/**
 * Story 1.3 — Password Management
 * Playwright E2E tests: forgot-password, reset-password, change password
 *
 * Điều kiện chạy:
 *   - Dev server đang chạy: npm run dev  (port 5173)
 *   - Supabase local đang chạy: npx supabase start (port 54321)
 *
 * Strategy mock:
 *   - Supabase đọc session từ localStorage (key: sb-127-auth-token), KHÔNG phải network.
 *   - Dùng page.addInitScript() để inject session vào localStorage TRƯỚC khi trang load.
 *   - Các Supabase REST API call (signInWithPassword, updateUser) vẫn dùng page.route().
 *
 * CardTitle trong shadcn/ui render là <div>, không phải <h3>.
 * Dùng getByText() thay getByRole('heading') cho CardTitle.
 * Team settings page dùng <h1> thật → getByRole('heading') OK.
 */

import { expect, test } from '@playwright/test'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Supabase JS v2 localStorage key cho local instance (http://127.0.0.1:54321) */
const SUPABASE_STORAGE_KEY = 'sb-127-auth-token'
const FAKE_TENANT_ID = 'tenant-fixture-uuid-1234'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Tạo fake JWT với tenant_roles claim (Node.js Buffer — không cần btoa).
 * JWT không có chữ ký thật nhưng jwtDecode chỉ base64-decode payload, không verify.
 */
function makeJwt(tenantRoles: Record<string, string> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-test-123',
      email: 'test@example.com',
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
      email: 'test@example.com',
      role: 'authenticated',
    },
  }
}

/**
 * Inject auth session vào localStorage TRƯỚC khi trang load.
 * JWT có tenant_roles để _app beforeLoad không redirect về /create-tenant.
 * PHẢI gọi trước page.goto().
 */
async function injectAuthSession(page: import('@playwright/test').Page) {
  const session = makeSession({ [FAKE_TENANT_ID]: 'owner' })
  await page.addInitScript(
    ([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data))
    },
    [SUPABASE_STORAGE_KEY, session]
  )
}

/**
 * Inject recovery session (không cần tenant_roles — /reset-password nằm ngoài _app).
 * PHẢI gọi trước page.goto().
 */
async function injectRecoverySession(page: import('@playwright/test').Page) {
  const session = {
    access_token: makeJwt(), // không cần tenant_roles
    refresh_token: 'fake-recovery-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-test-123',
      email: 'test@example.com',
      role: 'authenticated',
    },
  }
  await page.addInitScript(
    ([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data))
    },
    [SUPABASE_STORAGE_KEY, session]
  )
}

// ─── 1. Sign-in page ─────────────────────────────────────────────────────────

test.describe('Sign-in page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
  })

  test('hiển thị link "Quên mật khẩu?" trong form đăng nhập', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /đăng nhập/i })).toBeVisible()
    const forgotLink = page.getByRole('link', { name: /quên mật khẩu/i })
    await expect(forgotLink).toBeVisible()
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password')
  })

  test('click "Quên mật khẩu?" điều hướng đến /forgot-password', async ({ page }) => {
    await page.getByRole('link', { name: /quên mật khẩu/i }).click()
    await expect(page).toHaveURL('/forgot-password')
  })
})

// ─── 2. Forgot Password page ─────────────────────────────────────────────────

test.describe('Forgot Password page (/forgot-password)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
  })

  test('render đúng: tiêu đề, mô tả, form, link quay lại', async ({ page }) => {
    // CardTitle render là <div> trong shadcn/ui → dùng getByText()
    await expect(page.getByText('Quên mật khẩu')).toBeVisible()
    await expect(page.getByPlaceholder(/ban@example.com/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /gửi email/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /quay lại đăng nhập/i })).toBeVisible()
  })

  test('validate email không hợp lệ — hiển thị inline error', async ({ page }) => {
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({}) })
    )
    await page.getByPlaceholder(/ban@example.com/i).fill('khong-phai-email')
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/email không hợp lệ/i)).toBeVisible({ timeout: 5000 })
  })

  test('validate email rỗng — hiển thị inline error', async ({ page }) => {
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/email không hợp lệ/i)).toBeVisible()
  })

  test('submit email hợp lệ → hiển thị success state (anti-enumeration)', async ({ page }) => {
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({}) })
    )
    await page.getByPlaceholder(/ban@example.com/i).fill('test@example.com')
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/nếu email tồn tại/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /gửi email/i })).not.toBeVisible()
  })

  test('submit email hợp lệ → success state dù Supabase lỗi (anti-enumeration vẫn giữ)', async ({
    page,
  }) => {
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 429, body: JSON.stringify({ message: 'rate limited' }) })
    )
    await page.getByPlaceholder(/ban@example.com/i).fill('test@example.com')
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/nếu email tồn tại/i)).toBeVisible({ timeout: 5000 })
  })

  test('link "Quay lại đăng nhập" điều hướng về /sign-in', async ({ page }) => {
    await page.getByRole('link', { name: /quay lại đăng nhập/i }).click()
    await expect(page).toHaveURL('/sign-in')
  })
})

// ─── 3. Reset Password page ──────────────────────────────────────────────────

test.describe('Reset Password page (/reset-password)', () => {
  test('không có recovery session → hiển thị "Link đã hết hạn"', async ({ page }) => {
    // Không inject session → localStorage trống → getSession() trả về null → hasSession=false
    await page.goto('/reset-password')
    // CardTitle render là <div> → dùng getByText()
    await expect(page.getByText('Link đã hết hạn')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/vui lòng yêu cầu reset password lại/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /yêu cầu lại/i })).toBeVisible()
  })

  test('?error=access_denied → hiển thị "Link đã hết hạn"', async ({ page }) => {
    await page.goto('/reset-password?error=access_denied&error_description=Email+link+expired')
    await expect(page.getByText('Link đã hết hạn')).toBeVisible({ timeout: 5000 })
  })

  test('"Yêu cầu lại" link điều hướng về /forgot-password', async ({ page }) => {
    await page.goto('/reset-password')
    await page.getByRole('link', { name: /yêu cầu lại/i }).click()
    await expect(page).toHaveURL('/forgot-password')
  })

  test('có recovery session → hiển thị form đặt lại mật khẩu', async ({ page }) => {
    await injectRecoverySession(page)
    await page.goto('/reset-password')
    // CardTitle render là <div> → dùng getByText()
    await expect(page.getByText('Đặt lại mật khẩu')).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/mật khẩu mới/i)).toBeVisible()
    await expect(page.getByLabel(/xác nhận mật khẩu mới/i)).toBeVisible()
  })

  test('validate: password < 8 ký tự → inline error', async ({ page }) => {
    await injectRecoverySession(page)
    await page.goto('/reset-password')
    await expect(page.getByText('Đặt lại mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu mới/i).fill('short')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('short')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()
    await expect(page.getByText(/tối thiểu 8 ký tự/i)).toBeVisible()
  })

  test('validate: password không khớp → inline error', async ({ page }) => {
    await injectRecoverySession(page)
    await page.goto('/reset-password')
    await expect(page.getByText('Đặt lại mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu mới/i).fill('password123')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('different456')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()
    await expect(page.getByText(/mật khẩu xác nhận không khớp/i)).toBeVisible()
  })

  test('submit thành công → toast success + redirect /sign-in', async ({ page }) => {
    await injectRecoverySession(page)

    await page.route('**/auth/v1/user**', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'user-1' } }),
        })
      }
      return route.continue()
    })

    await page.goto('/reset-password')
    await expect(page.getByText('Đặt lại mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword123!')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()

    await expect(page.getByText(/đặt lại mật khẩu thành công/i)).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL('/sign-in', { timeout: 5000 })
  })
})

// ─── 4. Change Password — Settings/Profile ───────────────────────────────────

test.describe('Change Password (/settings/profile)', () => {
  test('không có session → redirect về /sign-in', async ({ page }) => {
    // Không inject session → localStorage trống → getSession() null → redirect
    await page.goto('/settings/profile')
    await expect(page).toHaveURL('/sign-in', { timeout: 5000 })
  })

  test('render form đổi mật khẩu với 3 fields', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')

    // CardTitle render là <div> → dùng getByText()
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/mật khẩu hiện tại/i)).toBeVisible()
    await expect(page.getByLabel(/mật khẩu mới/i)).toBeVisible()
    await expect(page.getByLabel(/xác nhận mật khẩu mới/i)).toBeVisible()
  })

  test('settings sidebar có tabs "Tài khoản" và "Nhóm"', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')

    await expect(page.getByRole('link', { name: /tài khoản/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('link', { name: /nhóm/i })).toBeVisible()
  })

  test('validate: currentPassword rỗng → inline error', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu mới/i).fill('NewPass123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPass123!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()
    await expect(page.getByText(/vui lòng nhập mật khẩu hiện tại/i)).toBeVisible()
  })

  test('validate: newPassword < 8 ký tự → inline error', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPass123!')
    await page.getByLabel(/mật khẩu mới/i).fill('short')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('short')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()
    await expect(page.getByText(/tối thiểu 8 ký tự/i)).toBeVisible()
  })

  test('validate: confirmNewPassword không khớp → inline error', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPass123!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPass123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('DifferentPass!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()
    await expect(page.getByText(/mật khẩu xác nhận không khớp/i)).toBeVisible()
  })

  test('sai mật khẩu hiện tại → inline error dưới field currentPassword', async ({ page }) => {
    await injectAuthSession(page)

    await page.route('**/auth/v1/token?grant_type=password**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    )

    await page.goto('/settings/profile')
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu hiện tại/i).fill('WrongPassword!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword123!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    await expect(page.getByText(/mật khẩu hiện tại không đúng/i)).toBeVisible({ timeout: 5000 })
  })

  test('đổi mật khẩu thành công → toast success, form reset', async ({ page }) => {
    await injectAuthSession(page)

    await page.route('**/auth/v1/token?grant_type=password**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'new-token',
          user: { id: 'user-test-123', email: 'test@example.com' },
        }),
      })
    )

    await page.route('**/auth/v1/user**', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'user-test-123' } }),
        })
      }
      return route.continue()
    })

    await page.goto('/settings/profile')
    await expect(page.getByText('Đổi mật khẩu')).toBeVisible({ timeout: 5000 })

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPassword123!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword456!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword456!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    await expect(page.getByText(/đổi mật khẩu thành công/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/mật khẩu hiện tại/i)).toHaveValue('')
  })

  test('settings/team đã được implement trong Story 1.4', async ({ page }) => {
    await injectAuthSession(page)
    await page.route('**/rest/v1/tenants**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: FAKE_TENANT_ID,
          name: 'Test Team',
          timezone: 'Asia/Ho_Chi_Minh',
          schedule_deadline_day: 0,
          schedule_deadline_hour: 23,
          daily_report_deadline_hour: 3,
          default_committed_hours: 40,
        }),
      })
    )
    await page.goto('/settings/team')

    await expect(page.getByText(/tính năng đang phát triển/i)).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/story 1\.4/i)).not.toBeVisible()
    // h1 thật → getByRole('heading') OK
    await expect(page.getByRole('heading', { name: /cài đặt nhóm/i })).toBeVisible({
      timeout: 5000,
    })
  })
})
