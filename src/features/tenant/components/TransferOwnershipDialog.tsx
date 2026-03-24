import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTransferOwnership } from '@/features/tenant/hooks/use-transfer-ownership'

interface TransferOwnershipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  memberName: string
}

export function TransferOwnershipDialog({ open, onOpenChange, userId, memberName }: TransferOwnershipDialogProps) {
  const { mutateAsync, isPending } = useTransferOwnership()

  const handleConfirm = async () => {
    try {
      await mutateAsync(userId)
      toast.success(`Đã chuyển quyền Owner cho ${memberName}.`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể chuyển quyền. Vui lòng thử lại.'
      toast.error(message)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Chuyển quyền Owner'
      desc={`Chuyển quyền Owner cho ${memberName}? Bạn sẽ trở thành Manager.`}
      confirmText='Chuyển quyền'
      cancelBtnText='Hủy'
      isLoading={isPending}
      handleConfirm={handleConfirm}
    />
  )
}
