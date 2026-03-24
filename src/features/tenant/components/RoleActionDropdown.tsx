import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/use-permissions'
import { RemoveMemberDialog } from '@/features/tenant/components/RemoveMemberDialog'
import { PromoteMemberDialog } from '@/features/tenant/components/PromoteMemberDialog'
import { DemoteMemberDialog } from '@/features/tenant/components/DemoteMemberDialog'
import { TransferOwnershipDialog } from '@/features/tenant/components/TransferOwnershipDialog'

interface RoleActionDropdownProps {
  userId: string
  memberName: string
  currentRole: 'owner' | 'manager' | 'member'
  /** User ID of the current session — để ẩn actions cho chính mình */
  currentUserId: string
}

export function RoleActionDropdown({
  userId,
  memberName,
  currentRole,
  currentUserId,
}: RoleActionDropdownProps) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [demoteOpen, setDemoteOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  // P5: canPromoteMembers = Owner only (promote + transfer ownership)
  const { canPromoteMembers } = usePermissions()

  // Không hiện dropdown cho chính mình
  if (userId === currentUserId) return null

  const hasPromoteActions = canPromoteMembers && currentRole === 'member'
  const hasDemoteAction = canPromoteMembers && currentRole === 'manager'
  const hasTransferAction = canPromoteMembers && currentRole !== 'owner'
  const hasSeparator = hasPromoteActions || hasDemoteAction || hasTransferAction

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8'>
            <MoreHorizontal className='h-4 w-4' />
            <span className='sr-only'>Hành động</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {/* "Nâng lên Manager" — chỉ Owner, chỉ khi target là member — AC#2 */}
          {hasPromoteActions && (
            <DropdownMenuItem onClick={() => setPromoteOpen(true)}>
              Nâng lên Manager
            </DropdownMenuItem>
          )}
          {/* "Hạ xuống Member" — chỉ Owner, chỉ khi target là manager */}
          {hasDemoteAction && (
            <DropdownMenuItem onClick={() => setDemoteOpen(true)}>
              Hạ xuống Member
            </DropdownMenuItem>
          )}
          {/* "Chuyển quyền Owner" — chỉ Owner, target là manager hoặc member — AC#3 */}
          {hasTransferAction && (
            <DropdownMenuItem onClick={() => setTransferOpen(true)}>
              Chuyển quyền Owner
            </DropdownMenuItem>
          )}
          {hasSeparator && <DropdownMenuSeparator />}
          {/* "Xóa khỏi team" — Owner và Manager có thể xóa — AC#1 */}
          <DropdownMenuItem
            onClick={() => setRemoveOpen(true)}
            className='text-destructive focus:text-destructive'
          >
            Xóa khỏi team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveMemberDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        userId={userId}
        memberName={memberName}
      />
      <PromoteMemberDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        userId={userId}
        memberName={memberName}
      />
      <DemoteMemberDialog
        open={demoteOpen}
        onOpenChange={setDemoteOpen}
        userId={userId}
        memberName={memberName}
      />
      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        userId={userId}
        memberName={memberName}
      />
    </>
  )
}
