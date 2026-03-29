import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { AuthorMapping, TekSpaceUser } from '../types/ai-parse.types'

interface UserMappingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  externalAuthor: string
  suggestedMatch: { user: TekSpaceUser; confidence: number } | null
  availableUsers: TekSpaceUser[]
  currentMapping: AuthorMapping | undefined
  onConfirm: (userId: string) => void
}

export function UserMappingModal({
  open,
  onOpenChange,
  externalAuthor,
  suggestedMatch,
  availableUsers,
  currentMapping,
  onConfirm,
}: UserMappingModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    suggestedMatch?.user.id ?? currentMapping?.userId ?? ''
  )

  const selectedUser = availableUsers.find((u) => u.id === selectedUserId)

  const confidence =
    selectedUserId === suggestedMatch?.user.id
      ? suggestedMatch?.confidence ?? 0
      : 1.0 // manual selection = 100% confidence

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Map Author</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* External author being mapped */}
          <div className='space-y-1.5'>
            <Label className='text-xs text-muted-foreground'>Author từ chat</Label>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>{externalAuthor}</span>
              {suggestedMatch && (
                <Badge variant='secondary' className='text-xs'>
                  Đề xuất: {suggestedMatch.user.full_name} ({(suggestedMatch.confidence * 100).toFixed(0)}%)
                </Badge>
              )}
            </div>
          </div>

          {/* User selector */}
          <div className='space-y-1.5'>
            <Label htmlFor='user-select' className='text-xs text-muted-foreground'>
              Map đến thành viên TekSpace
            </Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id='user-select'>
                <SelectValue placeholder='Chọn thành viên...' />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedUser && (
            <div className='rounded-lg border bg-muted/50 p-3 space-y-1 text-sm'>
              <p className='font-medium'>{externalAuthor}</p>
              <p className='text-muted-foreground'>→ {selectedUser.full_name}</p>
              <p className='text-xs text-muted-foreground'>
                Confidence: {(confidence * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={() => onConfirm(selectedUserId)} disabled={!selectedUserId}>
            Xác nhận Map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
