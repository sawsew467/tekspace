import { supabase } from '@/lib/supabase-browser'

export const updateTimezone = async (userId: string, timezone: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ timezone })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
}

export const updateActiveTenant = async (userId: string, tenantId: string): Promise<void> => {
  // Lưu active_tenant_id vào DB để custom_access_token_hook đọc được
  const { error } = await supabase
    .from('users')
    .update({ active_tenant_id: tenantId })
    .eq('id', userId)
    .select('id')
    .single()
  if (error) throw error
}

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, timezone, active_tenant_id')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ================================================================
// Avatar upload/delete functions (Story 8-10)
// ================================================================


// P-7: Bỏ .select('id').single() — return value không dùng, gây PGRST116 nếu RLS SELECT chặt
export const updateAvatarUrl = async (userId: string, avatarUrl: string | null): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
  if (error) throw error
}

// P-6: Helper nội bộ — extract storage path từ Supabase public URL (robust hơn regex cũ)
// Supabase URL format: https://<project>.supabase.co/storage/v1/object/public/avatars/<path>
function extractAvatarStoragePath(publicUrl: string): string | null {
  try {
    const urlObj = new URL(publicUrl)
    // Match cả public và sign URL format của Supabase
    const match = urlObj.pathname.match(/\/object\/(?:public|sign)\/avatars\/(.+)/)
    if (!match?.[1]) {
      console.warn('[avatar] Cannot extract storage path from URL:', publicUrl)
      return null
    }
    return match[1]
  } catch {
    return null
  }
}

// P-6: Best-effort xóa file storage — không throw, không block flow chính
async function deleteAvatarStorageFile(avatarUrl: string): Promise<void> {
  const path = extractAvatarStoragePath(avatarUrl)
  if (path) {
    await supabase.storage.from('avatars').remove([path])
  }
}

// P-1: Cleanup old file trước khi upload để tránh orphaned files tích lũy
export const uploadAvatarFile = async (
  userId: string,
  file: File,
  currentAvatarUrl: string | null = null,
): Promise<string> => {
  // Best-effort xóa file cũ trước khi upload mới
  if (currentAvatarUrl) {
    try {
      await deleteAvatarStorageFile(currentAvatarUrl)
    } catch {
      // Không block upload nếu cleanup thất bại
    }
  }

  const path = `${userId}/${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export const deleteAvatar = async (userId: string, currentAvatarUrl: string | null): Promise<void> => {
  // Best-effort xóa file storage (dùng helper robust)
  if (currentAvatarUrl) {
    try {
      await deleteAvatarStorageFile(currentAvatarUrl)
    } catch {
      // Best-effort: không throw nếu xóa file storage thất bại
    }
  }
  // Set null trong DB
  await updateAvatarUrl(userId, null)
}
