import { useMutation } from '@tanstack/react-query'
import { acceptInvite } from '@/features/tenant/services/tenant.service'

export function useAcceptInvite() {
  return useMutation({
    // P1: userId không còn truyền qua body — Edge Function extract từ JWT đã xác thực
    mutationFn: (token: string) => acceptInvite(token),
    // onSuccess / onError được xử lý tại component để điều hướng phù hợp
  })
}
