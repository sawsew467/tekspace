import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  // Login: chỉ cần non-empty — KHÔNG validate min 8 vì block valid users có password cũ
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128, 'Mật khẩu tối đa 128 ký tự'),
})

export const registerSchema = z
  .object({
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
