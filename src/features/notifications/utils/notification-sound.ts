// Shared AudioContext singleton — tạo một lần, tái sử dụng cho tất cả sounds
// (tạo mới mỗi lần sẽ bị suspended bởi browser autoplay policy)
let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctor()
    }
    return sharedCtx
  } catch {
    return null
  }
}

// Unlock AudioContext khi user tương tác lần đầu (click / keydown / touch)
// Browser chỉ cho phép audio sau khi có user gesture — đây là pattern chuẩn
// Listeners tự remove khi AudioContext đã running để tránh memory leak
if (typeof document !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    } else {
      // AudioContext đã running — không cần listen nữa
      document.removeEventListener('click', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
    }
  }
  document.addEventListener('click', unlockAudio)
  document.addEventListener('keydown', unlockAudio)
  document.addEventListener('touchstart', unlockAudio)
}

/**
 * Phát tiếng "ping" ngắn khi có notification mới.
 * Dùng Web Audio API với shared AudioContext — không cần file âm thanh.
 * Silent fail nếu trình duyệt không hỗ trợ hoặc user chưa interact với trang.
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext()
    // Không phát nếu context chưa được unlock (chưa có user gesture)
    if (!ctx || ctx.state === 'suspended') return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Âm thanh "ping": 880Hz → 440Hz trong 0.08s, fade out trong 0.25s
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08)

    gainNode.gain.setValueAtTime(0.25, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.25)

    // Chỉ disconnect oscillator/gain sau khi xong — KHÔNG đóng shared context
    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
  } catch {
    // Silent fail — không block app nếu Web Audio API unavailable
  }
}


