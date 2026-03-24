import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDemoteMember } from '@/features/tenant/hooks/use-demote-member'

interface DemoteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  memberName: string
}

export function DemoteMemberDialog({ open, onOpenChange, userId, memberName }: DemoteMemberDialogProps) {
  const { mutateAsync, isPending } = useDemoteMember()

  const handleConfirm = async () => {
    try {
      await mutateAsync(userId)
      toast.success(`Đã hạ quyền ${memberName} xuống Member.`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể hạ quyền. Vui lòng thử lại.'
      toast.error(message)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Hạ xuống Member'
      desc={`Hạ ${memberName} xuống Member? Họ sẽ mất quyền Manager.`}
      confirmText='Hạ quyền'
      cancelBtnText='Hủy'
      isLoading={isPending}
      handleConfirm={handleConfirm}
    />
  )
}
