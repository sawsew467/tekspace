import { useState } from 'react'
import { AlertCircle, Copy, MailCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTenantInvites } from '@/features/tenant/hooks/use-tenant-invites'
import { useResendInvite } from '@/features/tenant/hooks/use-resend-invite'
import type { TenantInvite } from '@/features/tenant/services/tenant.service'

type BadgeConfig = {
  label: string
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  className?: string
}

const STATUS_CONFIG: Record<TenantInvite['status'], BadgeConfig> = {
  pending: { label: 'Đang chờ', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-transparent' },
  accepted: { label: 'Đã chấp nhận', className: 'bg-green-100 text-green-800 hover:bg-green-100 border-transparent' },
  expired: { label: 'Đã hết hạn', variant: 'secondary' },
  revoked: { label: 'Đã thu hồi', variant: 'secondary' },
  declined: { label: 'Đã từ chối', variant: 'secondary' },
}

interface InviteListSectionProps {
  canManage: boolean
}

export function InviteListSection({ canManage }: InviteListSectionProps) {
  const { data: invites, isLoading, isError } = useTenantInvites()
  const { mutateAsync: resend, isPending: isResending, variables } = useResendInvite()
  // P13: confirm dialog cho pending invite (gửi lại sẽ hủy link cũ)
  const [pendingResendInvite, setPendingResendInvite] = useState<TenantInvite | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)

  const handleResend = async (invite: TenantInvite) => {
    try {
      await resend({ inviteId: invite.id, email: invite.email })
      toast.success(`Đã gửi lại lời mời đến ${invite.email}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể gửi lại lời mời.'
      toast.error(message)
    }
  }

  const handleResendClick = (invite: TenantInvite) => {
    // P13: nếu link đang pending (còn hiệu lực) → cần warn trước
    if (invite.status === 'pending') {
      setPendingResendInvite(invite)
    } else {
      // expired: không cần warn, link cũ đã vô hiệu
      void handleResend(invite)
    }
  }

  const handleCopyLink = async (invite: TenantInvite) => {
    if (copyingId === invite.id) return
    setCopyingId(invite.id)
    const inviteUrl = `${window.location.origin}/accept-invite?token=${invite.token}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Đã copy link lời mời')
    } catch {
      toast.error('Không thể copy link. Vui lòng thử lại.')
    } finally {
      setCopyingId(null)
    }
  }

  if (isLoading) {
    return <div className='text-muted-foreground py-8 text-center text-sm'>Đang tải...</div>
  }

  if (isError) {
    return (
      <div className='text-destructive flex flex-col items-center gap-3 py-12'>
        <AlertCircle className='h-8 w-8' />
        <p className='text-sm'>Không thể tải danh sách lời mời. Vui lòng thử lại.</p>
      </div>
    )
  }

  if (!invites?.length) {
    return (
      <div className='text-muted-foreground flex flex-col items-center gap-3 py-12'>
        <MailCheck className='h-8 w-8' />
        <p className='text-sm'>Chưa có lời mời nào.</p>
      </div>
    )
  }

  return (
    <>
      <div className='space-y-4'>
        <div>
          <h2 className='text-lg font-semibold'>Lời mời ({invites.length})</h2>
          <p className='text-muted-foreground text-sm'>Lịch sử lời mời tham gia team.</p>
        </div>
        <div className='divide-y rounded-md border'>
          {invites.map((invite) => {
            const isResendingThis = isResending && variables?.inviteId === invite.id
            const canResend = canManage && (invite.status === 'pending' || invite.status === 'expired')
            return (
              <div key={invite.id} className='flex items-center justify-between px-4 py-3'>
                <div className='min-w-0 flex-1'>
                  <p className='truncate font-medium'>{invite.email}</p>
                  <p className='text-muted-foreground text-sm'>
                    {new Date(invite.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className='ml-4 flex items-center gap-3'>
                  <Badge variant={STATUS_CONFIG[invite.status].variant} className={STATUS_CONFIG[invite.status].className}>
                    {STATUS_CONFIG[invite.status].label}
                  </Badge>
                  {canManage && invite.status === 'pending' && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => void handleCopyLink(invite)}
                      disabled={copyingId === invite.id}
                      title='Copy link lời mời'
                    >
                      <Copy className='h-3 w-3' />
                    </Button>
                  )}
                  {canResend && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleResendClick(invite)}
                      disabled={isResendingThis}
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${isResendingThis ? 'animate-spin' : ''}`} />
                      Gửi lại
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* P13: Confirm dialog khi resend invite đang pending — link cũ sẽ bị hủy */}
      <ConfirmDialog
        open={!!pendingResendInvite}
        onOpenChange={(open) => { if (!open) setPendingResendInvite(null) }}
        title='Gửi lại lời mời'
        desc={`Link mời hiện tại của ${pendingResendInvite?.email ?? ''} sẽ bị hủy khi gửi lại. Tiếp tục?`}
        confirmText='Gửi lại'
        cancelBtnText='Hủy'
        isLoading={isResending && variables?.inviteId === pendingResendInvite?.id}
        handleConfirm={async () => {
          if (pendingResendInvite) {
            await handleResend(pendingResendInvite)
            setPendingResendInvite(null)
          }
        }}
      />
    </>
  )
}
