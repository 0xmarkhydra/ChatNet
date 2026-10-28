export type ToastKind = 'success' | 'error' | 'warning' | 'info'
export type ToastNotice = { id: number; message: string; kind: ToastKind }


export function inferToastKind(message: string): ToastKind {
  const normalized = message.trim().toLocaleLowerCase('vi-VN')
  if (
    normalized.startsWith('đã ') ||
    normalized.startsWith('bạn đã ') ||
    normalized.startsWith('chatnet đã ')
  ) return 'success'
  if (
    normalized.includes('không ') ||
    normalized.includes('thất bại') ||
    normalized.includes('bị chặn') ||
    normalized.startsWith('chưa xác nhận') ||
    normalized.startsWith('mất kết nối')
  ) return 'error'
  if (
    normalized.startsWith('mỗi ') ||
    normalized.startsWith('hãy ') ||
    normalized.startsWith('trên iphone') ||
    normalized.includes('chưa hỗ trợ')
  ) return 'warning'
  return 'info'
}
