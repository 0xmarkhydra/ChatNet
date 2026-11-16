export function friendlyCallError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Quyền camera/microphone bị từ chối. Hãy cho phép quyền rồi thử lại.'
    if (error.name === 'NotFoundError') return 'Không tìm thấy camera hoặc microphone phù hợp.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Không thể thiết lập cuộc gọi an toàn.'
}
