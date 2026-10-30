import { desktopBridge, isDesktopBuild } from './desktop'

export async function requireDesktopMedia(kind: 'microphone' | 'camera'): Promise<void> {
  if (!isDesktopBuild) return
  const label = kind === 'microphone' ? 'microphone' : 'camera'
  try {
    const permission = await desktopBridge().media.request(kind)
    if (permission.granted) return
  } catch {
    // Do not surface IPC implementation paths; the user needs recovery guidance, not internal errors.
  }
  const settings = document.documentElement.dataset.desktopOS === 'darwin'
    ? 'System Settings → Privacy & Security'
    : 'Windows Settings → Privacy & security'
  throw new Error(`Chưa có quyền ${label}. Cho phép SOCO tại ${settings}, mở lại ứng dụng nếu cần rồi thử lại.`)
}
