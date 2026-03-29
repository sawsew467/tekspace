import { AlertCircle, Users } from 'lucide-react'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { InviteMemberDialog } from '@/features/tenant/components/InviteMemberDialog'
import { RoleActionDropdown } from '@/features/tenant/components/RoleActionDropdown'
import { SetCommittedHoursDialog } from '@/features/tenant/components/SetCommittedHoursDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  manager: 'secondary',
  member: 'outline',
}

interface MemberListProps {
  canManage: boolean
  currentUserId: string
  // P5: undefined khi settings đang load — tránh hiển thị fallback 40h sai
  defaultCommittedHours: number | undefined
}

export function MemberList({ canManage, currentUserId, defaultCommittedHours }: MemberListProps) {
  // P14: destructure isError để xử lý trường hợp query thất bại
  const { data: members, isLoading, isError } = useTenantMembers()

  if (isLoading) {
    return <div className='text-muted-foreground py-8 text-center text-sm'>Đang tải...</div>
  }

  // P14: Error state — hiển thị thông báo thay vì list rỗng im lặng
  if (isError) {
    return (
      <div className='text-destructive flex flex-col items-center gap-3 py-12'>
        <AlertCircle className='h-8 w-8' />
        <p className='text-sm'>Không thể tải danh sách thành viên. Vui lòng thử lại.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Thành viên ({members?.length ?? 0})</h2>
          <p className='text-muted-foreground text-sm'>Danh sách thành viên đang hoạt động.</p>
        </div>
        {canManage && <InviteMemberDialog />}
      </div>

      {!members?.length ? (
        <div className='text-muted-foreground flex flex-col items-center gap-3 py-12'>
          <Users className='h-8 w-8' />
          <p className='text-sm'>Chưa có thành viên nào.</p>
        </div>
      ) : (
        <div className='divide-y rounded-md border'>
          {members.map((member) => {
            const memberName =
              member.users.full_name || member.users.email?.split('@')[0] || 'Member'
            return (
              <div key={member.id} className='flex items-center justify-between px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <Avatar className='h-8 w-8'>
                    <AvatarFallback className='text-xs'>
                      {getInitials(
                        member.users.full_name || member.users.email?.split('@')[0] || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className='font-medium'>{memberName}</p>
                    {/* P5: Hiển thị email */}
                    <p className='text-muted-foreground text-xs'>
                      {member.users.email ?? member.users.timezone}
                    </p>
                    {/* Committed hours — read-only cho tất cả */}
                    <p className='text-muted-foreground text-xs'>
                      {member.committed_hours != null
                        ? `${member.committed_hours}h/tuần (riêng)`
                        : defaultCommittedHours !== undefined
                          ? `${defaultCommittedHours}h/tuần (mặc định nhóm)`
                          : '—h/tuần (mặc định nhóm)'}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {/* Chỉ Manager/Owner thấy nút chỉnh sửa giờ cam kết — chờ settings load */}
                  {canManage && defaultCommittedHours !== undefined && (
                    <SetCommittedHoursDialog
                      memberId={member.id}
                      memberName={memberName}
                      currentCommittedHours={member.committed_hours}
                      defaultCommittedHours={defaultCommittedHours}
                    />
                  )}
                  <Badge variant={ROLE_VARIANT[member.role] ?? 'outline'}>
                    {ROLE_LABEL[member.role] ?? member.role}
                  </Badge>
                  {/* Chỉ Owner/Manager thấy role action dropdown */}
                  {canManage && member.role !== 'owner' && (
                    <RoleActionDropdown
                      userId={member.user_id}
                      memberName={member.users.full_name}
                      currentRole={member.role}
                      currentUserId={currentUserId}
                      canManage={canManage}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
