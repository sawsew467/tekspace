import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { uploadAvatarFile, updateAvatarUrl, deleteAvatar } from '../services/settings.service'
import { QUERY_KEYS } from '@/lib/query-keys'

// P-1: mutationFn nhận cả blob lẫn currentAvatarUrl để cleanup file cũ trước khi upload
type UploadAvatarPayload = {
  blob: Blob
  currentAvatarUrl: string | null
}

export const useUploadAvatar = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    // P-2: retry: 1 — nếu uploadFile ok nhưng updateAvatarUrl fail, retry 1 lần
    retry: 1,
    mutationFn: async ({ blob, currentAvatarUrl }: UploadAvatarPayload) => {
      if (!user?.id) throw new Error('User not authenticated')
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      // P-1: truyền currentAvatarUrl → service sẽ cleanup file cũ trước khi upload
      const publicUrl = await uploadAvatarFile(user.id, file, currentAvatarUrl)
      await updateAvatarUrl(user.id, publicUrl)
    },
    onSuccess: () => {
      toast.success('Đã cập nhật ảnh đại diện')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.userProfile, user?.id] })
    },
    onError: () => {
      toast.error('Không thể upload ảnh. Vui lòng thử lại.')
    },
  })
}

export const useDeleteAvatar = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    retry: 1,
    mutationFn: async (currentAvatarUrl: string | null) => {
      if (!user?.id) throw new Error('User not authenticated')
      await deleteAvatar(user.id, currentAvatarUrl)
    },
    onSuccess: () => {
      toast.success('Đã xóa ảnh đại diện')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.userProfile, user?.id] })
    },
    onError: () => {
      toast.error('Không thể xóa ảnh. Vui lòng thử lại.')
    },
  })
}
