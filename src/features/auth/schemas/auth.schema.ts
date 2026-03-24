import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  // Login: chỉ cần non-empty — KHÔNG validate min 8 vì block valid users có password cũ
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128, 'Mật khẩu tối đa 128 ký tự'),
})

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ và tên tối thiểu 2 ký tự').max(100, 'Họ và tên tối đa 100 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu tối đa 128 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu tối đa 128 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu tối đa 128 ký tự'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmNewPassword'],
  })

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
