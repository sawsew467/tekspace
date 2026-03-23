/**
 * Story 1.3 — Password Management
 * Playwright E2E tests: forgot-password, reset-password, change password
 *
 * Điều kiện chạy:
 *   - Dev server đang chạy: npm run dev  (port 5173)
 *   - Supabase local đang chạy: npx supabase start (port 54321)
 *
 * Các test dưới đây tập trung vào UI/routing không cần backend thật:
 *   - Form rendering, validation, success states
 *   - Route guards (no session → expired UI)
 *   - Navigation flow
 *
 * Tests cần auth (change password) dùng Supabase mock via route intercept.
 */

import { expect, test } from '@playwright/test'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Chặn mọi request đến Supabase Auth để giả lập behavior */
async function mockSupabaseAuth(
  page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? never : never,
) {
  return page
}

// ─── 1. Sign-in page ─────────────────────────────────────────────────────────

test.describe('Sign-in page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
  })

  test('hiển thị link "Quên mật khẩu?" trong form đăng nhập', async ({ page }) => {
    // Đảm bảo tab "Đăng nhập" đang active
    await expect(page.getByRole('tab', { name: /đăng nhập/i })).toBeVisible()

    // Link "Quên mật khẩu?" phải tồn tại
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
    await expect(page.getByRole('heading', { name: /quên mật khẩu/i })).toBeVisible()
    await expect(page.getByPlaceholder(/ban@example.com/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /gửi email/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /quay lại đăng nhập/i })).toBeVisible()
  })

  test('validate email không hợp lệ — hiển thị inline error', async ({ page }) => {
    await page.getByPlaceholder(/ban@example.com/i).fill('khong-phai-email')
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/email không hợp lệ/i)).toBeVisible()
  })

  test('validate email rỗng — hiển thị inline error', async ({ page }) => {
    await page.getByRole('button', { name: /gửi email/i }).click()
    await expect(page.getByText(/email không hợp lệ/i)).toBeVisible()
  })

  test('submit email hợp lệ → hiển thị success state (anti-enumeration)', async ({ page }) => {
    // Mock Supabase resetPasswordForEmail — trả về success
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({}) }),
    )

    await page.getByPlaceholder(/ban@example.com/i).fill('test@example.com')
    await page.getByRole('button', { name: /gửi email/i }).click()

    // Success state: không còn form, hiện message anti-enumeration
    await expect(page.getByText(/nếu email tồn tại/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /gửi email/i })).not.toBeVisible()
  })

  test('submit email hợp lệ → success state dù Supabase lỗi (anti-enumeration vẫn giữ)', async ({
    page,
  }) => {
    // Mock Supabase trả về error — UI vẫn phải hiện success (không lộ thông tin)
    await page.route('**/auth/v1/otp**', (route) =>
      route.fulfill({ status: 429, body: JSON.stringify({ message: 'rate limited' }) }),
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
    // Mock getSession trả về null (không có session)
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}), // empty = no session
      }),
    )

    await page.goto('/reset-password')

    await expect(page.getByRole('heading', { name: /link đã hết hạn/i })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText(/vui lòng yêu cầu reset password lại/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /yêu cầu lại/i })).toBeVisible()
  })

  test('?error=access_denied → hiển thị "Link đã hết hạn"', async ({ page }) => {
    // Supabase redirect khi link hết hạn: ?error=access_denied&error_description=...
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    )

    await page.goto('/reset-password?error=access_denied&error_description=Email+link+expired')

    await expect(page.getByRole('heading', { name: /link đã hết hạn/i })).toBeVisible({
      timeout: 5000,
    })
  })

  test('"Yêu cầu lại" link điều hướng về /forgot-password', async ({ page }) => {
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    )

    await page.goto('/reset-password')
    await page.getByRole('link', { name: /yêu cầu lại/i }).click()
    await expect(page).toHaveURL('/forgot-password')
  })

  test('có recovery session → hiển thị form đặt lại mật khẩu', async ({ page }) => {
    // Mock valid recovery session
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-recovery-token',
          token_type: 'bearer',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      }),
    )

    await page.goto('/reset-password')

    await expect(page.getByRole('heading', { name: /đặt lại mật khẩu/i })).toBeVisible({
      timeout: 5000,
    })
    // Form có 2 password fields
    await expect(page.getByLabel(/mật khẩu mới/i)).toBeVisible()
    await expect(page.getByLabel(/xác nhận mật khẩu mới/i)).toBeVisible()
  })

  test('validate: password < 8 ký tự → inline error', async ({ page }) => {
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-token',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      }),
    )

    await page.goto('/reset-password')

    await page.getByLabel(/mật khẩu mới/i).fill('short')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('short')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()

    await expect(page.getByText(/tối thiểu 8 ký tự/i)).toBeVisible()
  })

  test('validate: password không khớp → inline error', async ({ page }) => {
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-token',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      }),
    )

    await page.goto('/reset-password')

    await page.getByLabel(/mật khẩu mới/i).fill('password123')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('different456')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()

    await expect(page.getByText(/mật khẩu xác nhận không khớp/i)).toBeVisible()
  })

  test('submit thành công → toast success + redirect /sign-in', async ({ page }) => {
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-token',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      }),
    )

    // Mock updateUser thành công
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

    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword123!')
    await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click()

    // Toast success và redirect
    await expect(page.getByText(/đặt lại mật khẩu thành công/i)).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL('/sign-in', { timeout: 5000 })
  })
})

// ─── 4. Change Password — Settings/Profile ───────────────────────────────────

test.describe('Change Password (/settings/profile)', () => {
  /**
   * Inject auth session vào localStorage để bypass auth guard.
   * Supabase lưu session dưới key "sb-<project-ref>-auth-token"
   */
  async function injectAuthSession(page: import('@playwright/test').Page) {
    // Mock getSession trong beforeLoad của _app route
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 'user-test-123',
            email: 'test@example.com',
            role: 'authenticated',
          },
        }),
      }),
    )
  }

  test('không có session → redirect về /sign-in', async ({ page }) => {
    // Không inject session — auth guard sẽ redirect
    await page.route('**/auth/v1/session**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}), // no session
      }),
    )

    await page.goto('/settings/profile')
    await expect(page).toHaveURL('/sign-in', { timeout: 5000 })
  })

  test('render form đổi mật khẩu với 3 fields', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')

    await expect(page.getByRole('heading', { name: /đổi mật khẩu/i })).toBeVisible({
      timeout: 5000,
    })
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

    await page.getByLabel(/mật khẩu mới/i).fill('NewPass123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPass123!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    await expect(page.getByText(/vui lòng nhập mật khẩu hiện tại/i)).toBeVisible()
  })

  test('validate: newPassword < 8 ký tự → inline error', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPass123!')
    await page.getByLabel(/mật khẩu mới/i).fill('short')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('short')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    await expect(page.getByText(/tối thiểu 8 ký tự/i)).toBeVisible()
  })

  test('validate: confirmNewPassword không khớp → inline error', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/profile')

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPass123!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPass123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('DifferentPass!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    await expect(page.getByText(/mật khẩu xác nhận không khớp/i)).toBeVisible()
  })

  test('sai mật khẩu hiện tại → inline error dưới field currentPassword', async ({ page }) => {
    await injectAuthSession(page)

    // Mock signInWithPassword thất bại
    await page.route('**/auth/v1/token?grant_type=password**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      }),
    )

    await page.goto('/settings/profile')

    await page.getByLabel(/mật khẩu hiện tại/i).fill('WrongPassword!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword123!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword123!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    // Inline error dưới field (không phải toast)
    await expect(page.getByText(/mật khẩu hiện tại không đúng/i)).toBeVisible({ timeout: 5000 })
  })

  test('đổi mật khẩu thành công → toast success, form reset', async ({ page }) => {
    await injectAuthSession(page)

    // Mock signInWithPassword thành công
    await page.route('**/auth/v1/token?grant_type=password**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'new-token',
          user: { id: 'user-test-123', email: 'test@example.com' },
        }),
      }),
    )

    // Mock updateUser thành công
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

    await page.getByLabel(/mật khẩu hiện tại/i).fill('OldPassword123!')
    await page.getByLabel(/mật khẩu mới/i).fill('NewPassword456!')
    await page.getByLabel(/xác nhận mật khẩu mới/i).fill('NewPassword456!')
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click()

    // Toast success
    await expect(page.getByText(/đổi mật khẩu thành công/i)).toBeVisible({ timeout: 5000 })

    // Form được reset — fields trống
    await expect(page.getByLabel(/mật khẩu hiện tại/i)).toHaveValue('')
  })

  test('settings/team hiển thị placeholder không có story ID', async ({ page }) => {
    await injectAuthSession(page)
    await page.goto('/settings/team')

    await expect(page.getByText(/tính năng đang phát triển/i)).toBeVisible({ timeout: 5000 })
    // Đảm bảo không có "Story 1.4" trong nội dung
    await expect(page.getByText(/story 1\.4/i)).not.toBeVisible()
  })
})
