// Upload to a presigned S3-compatible URL with real transport progress.
// Never attach the app's bearer token or cookies to this cross-origin request.
export function uploadPresignedFile(
  url: string,
  file: File,
  contentType: string,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Đã hủy tải tệp.', 'AbortError'))
      return
    }
    const xhr = new XMLHttpRequest()
    let settled = false
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const complete = (error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const onAbort = () => xhr.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(file.size, event.loaded))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size)
        complete()
      } else {
        complete(new Error(`S3 từ chối upload ${file.name} (HTTP ${xhr.status}). Kiểm tra CORS/quyền bucket.`))
      }
    }
    xhr.onerror = () => complete(new Error(`Không thể tải ${file.name} lên S3. Kiểm tra kết nối mạng/CORS.`))
    xhr.ontimeout = () => complete(new Error(`Upload ${file.name} quá thời gian cho phép.`))
    xhr.onabort = () => complete(new DOMException('Đã hủy tải tệp.', 'AbortError'))
    try {
      xhr.open('PUT', url)
      xhr.timeout = 120_000
      xhr.withCredentials = false
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.send(file)
    } catch (error) {
      complete(error instanceof Error ? error : new Error('Không thể bắt đầu upload'))
    }
  })
}
