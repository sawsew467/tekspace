import { AlertCircle, Users } from 'lucide-react'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { InviteMemberDialog } from '@/features/tenant/components/InviteMemberDialog'
import { Badge } from '@/components/ui/badge'

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

export function MemberList({ canManage }: { canManage: boolean }) {
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
          {members.map((member) => (
            <div key={member.id} className='flex items-center justify-between px-4 py-3'>
              <div>
                <p className='font-medium'>{member.users.full_name}</p>
                {/* P5: Hiển thị email (AC2) thay vì timezone */}
                <p className='text-muted-foreground text-sm'>
                  {member.users.email ?? member.users.timezone}
                </p>
              </div>
              <Badge variant={ROLE_VARIANT[member.role] ?? 'outline'}>
                {ROLE_LABEL[member.role] ?? member.role}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
