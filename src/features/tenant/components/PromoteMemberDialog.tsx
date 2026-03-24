import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePromoteMember } from '@/features/tenant/hooks/use-promote-member'

interface PromoteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  memberName: string
}

export function PromoteMemberDialog({ open, onOpenChange, userId, memberName }: PromoteMemberDialogProps) {
  const { mutateAsync, isPending } = usePromoteMember()

  const handleConfirm = async () => {
    try {
      await mutateAsync(userId)
      toast.success(`Đã nâng quyền ${memberName} lên Manager.`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể nâng quyền. Vui lòng thử lại.'
      toast.error(message)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Nâng lên Manager'
      desc={`Nâng ${memberName} lên Manager?`}
      confirmText='Nâng quyền'
      cancelBtnText='Hủy'
      isLoading={isPending}
      handleConfirm={handleConfirm}
    />
  )
}
