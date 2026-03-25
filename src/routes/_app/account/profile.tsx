import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { getUserProfile } from '@/features/settings/services/settings.service'
import { useUpdateTimezone } from '@/features/settings/hooks/use-update-timezone'
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { AvatarUploadCard } from '@/features/settings/components/AvatarUploadCard'
import { QUERY_KEYS } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase-browser'

export const Route = createFileRoute('/_app/account/profile')({
  head: () => ({
    meta: [{ title: 'Hồ sơ cá nhân — TekSpace' }],
  }),
  component: AccountProfilePage,
})

const fullNameSchema = z.object({
  full_name: z.string().trim().min(2, 'Họ và tên tối thiểu 2 ký tự').max(100),
})
type FullNameInput = z.infer<typeof fullNameSchema>

function AccountProfilePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.userProfile, user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  })

  const form = useForm<FullNameInput>({
    resolver: zodResolver(fullNameSchema),
    values: profile ? { full_name: profile.full_name ?? '' } : undefined,
    defaultValues: { full_name: '' },
  })

  const updateFullName = useMutation({
    mutationFn: async (data: FullNameInput) => {
      const { error } = await supabase
        .from('users')
        .update({ full_name: data.full_name })
        .eq('id', user!.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Đã cập nhật họ và tên')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.userProfile, user?.id] })
    },
    onError: () => {
      toast.error('Không thể cập nhật. Vui lòng thử lại.')
    },
  })

  const timezoneUpdateMutation = useUpdateTimezone()

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Hồ sơ cá nhân</h1>
        <p className='text-muted-foreground mt-1 text-sm'>Thông tin cá nhân của bạn</p>
      </div>

      {/* Ảnh đại diện — Story 8-10 */}
      <AvatarUploadCard
        avatarUrl={profile?.avatar_url ?? null}
        fullName={profile?.full_name ?? ''}
      />

      {/* Thông tin cá nhân */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cá nhân</CardTitle>
          <CardDescription>Tên hiển thị trong app và danh sách thành viên</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => updateFullName.mutate(data))}
                className='space-y-4'
              >
                <FormField
                  control={form.control}
                  name='full_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Họ và tên</FormLabel>
                      <FormControl>
                        <Input placeholder='Nguyễn Văn A' autoComplete='name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Email — read-only từ Supabase Auth */}
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium leading-none'>Email</label>
                  <Input value={user?.email ?? ''} disabled className='bg-muted' />
                  <p className='text-muted-foreground text-xs'>
                    Email không thể thay đổi sau khi tạo tài khoản
                  </p>
                </div>
                <Button type='submit' disabled={updateFullName.isPending}>
                  {updateFullName.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Timezone cá nhân */}
      <Card>
        <CardHeader>
          <CardTitle>Timezone cá nhân</CardTitle>
          <CardDescription>Timestamps trong app sẽ hiển thị theo timezone này</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {isLoading ? (
            <Skeleton className='h-10 w-full' />
          ) : (
            <>
              {(!profile?.timezone || profile.timezone === 'UTC') && (
                <Alert>
                  <AlertDescription>
                    Bạn chưa set timezone cá nhân. Vui lòng chọn timezone phù hợp.
                  </AlertDescription>
                </Alert>
              )}
              <TimezoneSelector
                value={profile?.timezone ?? 'UTC'}
                onChange={(tz) => timezoneUpdateMutation.mutate(tz)}
                disabled={timezoneUpdateMutation.isPending}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
