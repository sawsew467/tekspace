import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useRemoveMember } from '@/features/tenant/hooks/use-remove-member'

interface RemoveMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  memberName: string
}

export function RemoveMemberDialog({ open, onOpenChange, userId, memberName }: RemoveMemberDialogProps) {
  const { mutateAsync, isPending } = useRemoveMember()

  const handleConfirm = async () => {
    try {
      await mutateAsync(userId)
      toast.success(`Đã xóa ${memberName} khỏi team.`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể xóa thành viên. Vui lòng thử lại.'
      toast.error(message)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Xóa thành viên'
      desc={`Bạn có chắc muốn xóa ${memberName} khỏi team?`}
      confirmText='Xóa'
      cancelBtnText='Hủy'
      destructive
      isLoading={isPending}
      handleConfirm={handleConfirm}
    />
  )
}
