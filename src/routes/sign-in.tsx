import { createFileRoute } from '@tanstack/react-router'

// Placeholder — sẽ implement đầy đủ trong Story 1.2
// Story 1.2 sẽ thêm: form đăng nhập, validation, xử lý lỗi, redirect logic

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute('/sign-in' as any)({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className='flex min-h-svh items-center justify-center'>
      <div className='text-center'>
        <h1 className='text-2xl font-bold'>TekSpace</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          Sign in page — sẽ implement trong Story 1.2
        </p>
      </div>
    </div>
  )
}
