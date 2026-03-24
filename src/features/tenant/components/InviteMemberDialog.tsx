import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Copy, Check, Link } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { inviteMemberSchema, type InviteMemberInput } from '@/features/tenant/schemas/tenant.schema'
import { useInviteMember } from '@/features/tenant/hooks/use-invite-member'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

type DialogState =
  | { step: 'form' }
  | { step: 'success'; inviteLink: string; email: string }

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DialogState>({ step: 'form' })
  const [copied, setCopied] = useState(false)
  const mutation = useInviteMember()

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reset khi đóng dialog
      setTimeout(() => {
        setState({ step: 'form' })
        form.reset()
        setCopied(false)
      }, 200) // delay nhỏ để tránh flash khi animate close
    }
  }

  function handleSubmit(data: InviteMemberInput) {
    mutation.mutate(data.email, {
      onSuccess: ({ inviteLink }) => {
        setState({ step: 'success', inviteLink, email: data.email })
      },
    })
  }

  async function handleCopy() {
    if (state.step !== 'success') return
    try {
      await navigator.clipboard.writeText(state.inviteLink)
      setCopied(true)
      toast.success('Đã copy link lời mời!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Không thể copy. Vui lòng copy thủ công.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <UserPlus className='mr-2 h-4 w-4' />
          Mời thành viên
        </Button>
      </DialogTrigger>

      <DialogContent className='max-w-md w-full overflow-hidden'>
        {state.step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Mời thành viên mới</DialogTitle>
              <DialogDescription>
                Nhập email của người cần mời để tạo link invite có hiệu lực 48 giờ.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type='email'
                          placeholder='ten@congty.com'
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => handleOpenChange(false)}
                    disabled={mutation.isPending}
                  >
                    Hủy
                  </Button>
                  <Button type='submit' disabled={mutation.isPending}>
                    {mutation.isPending ? 'Đang tạo...' : 'Tạo link mời'}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Link lời mời đã sẵn sàng</DialogTitle>
              <DialogDescription>
                Gửi link này cho{' '}
                <span className='font-medium text-foreground'>{state.email}</span>{' '}
                qua Slack, Zalo hoặc bất kỳ kênh nào.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-3'>
              {/* Link display — truncate bằng JS cho chắc, copy vẫn dùng full URL */}
              <div className='flex items-center gap-2 rounded-md border bg-muted px-3 py-2'>
                <Link className='h-4 w-4 shrink-0 text-muted-foreground' />
                <p className='text-sm text-muted-foreground font-mono'>
                  {state.inviteLink.length > 46
                    ? state.inviteLink.slice(0, 46) + '…'
                    : state.inviteLink}
                </p>
              </div>

              {/* Copy button */}
              <Button
                className='w-full'
                onClick={handleCopy}
                variant={copied ? 'outline' : 'default'}
              >
                {copied ? (
                  <>
                    <Check className='mr-2 h-4 w-4 text-green-600' />
                    Đã copy!
                  </>
                ) : (
                  <>
                    <Copy className='mr-2 h-4 w-4' />
                    Copy link
                  </>
                )}
              </Button>

              <div className='flex items-center justify-between'>
                <p className='text-xs text-muted-foreground'>
                  Link có hiệu lực trong 48 giờ.
                </p>
                <Button variant='ghost' size='sm' onClick={() => handleOpenChange(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
