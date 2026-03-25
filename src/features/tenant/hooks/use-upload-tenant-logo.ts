import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTenantStore } from '@/stores/tenant-store'
import {
  uploadTenantLogoFile,
  updateTenantLogoUrl,
  deleteTenantLogo,
  removeLogoFromStorage,
} from '../services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'

type UploadLogoInput = {
  blob: Blob
  currentLogoUrl: string | null // Fix F1: logo cũ cần xóa sau upload thành công
}

export const useUploadTenantLogo = () => {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ blob, currentLogoUrl }: UploadLogoInput) => {
      if (!activeTenantId) throw new Error('No active tenant')
      // Fix F5: capture tenantId tại thời điểm mutation chạy — không dùng stale closure
      const tenantId = activeTenantId

      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' })

      // Bước 1: Upload file mới lên Storage
      const { publicUrl } = await uploadTenantLogoFile(tenantId, file)

      // Bước 2: Cập nhật DB — nếu fail thì rollback xóa file vừa upload (Fix F2)
      try {
        await updateTenantLogoUrl(tenantId, publicUrl)
      } catch (e) {
        await removeLogoFromStorage(publicUrl) // best-effort rollback
        throw e
      }

      // Bước 3: Xóa logo cũ sau khi DB update thành công (Fix F1, best-effort)
      if (currentLogoUrl) {
        await removeLogoFromStorage(currentLogoUrl)
      }

      return { tenantId } // Fix F5: trả về tenantId để onSuccess dùng
    },
    onSuccess: ({ tenantId }) => {
      toast.success('Đã cập nhật logo nhóm')
      // Fix F5: dùng tenantId từ mutation result, không phải stale closure
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantSettings, tenantId] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantNames] })
    },
    onError: () => {
      toast.error('Không thể upload logo. Vui lòng thử lại.')
    },
  })
}

export const useDeleteTenantLogo = () => {
  const { activeTenantId } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (currentLogoUrl: string | null) => {
      if (!activeTenantId) throw new Error('No active tenant')
      const tenantId = activeTenantId // Fix F5: capture at mutation time
      await deleteTenantLogo(tenantId, currentLogoUrl)
      return { tenantId }
    },
    onSuccess: ({ tenantId }) => {
      toast.success('Đã xóa logo nhóm')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantSettings, tenantId] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantNames] })
    },
    onError: () => {
      toast.error('Không thể xóa logo. Vui lòng thử lại.')
    },
  })
}
