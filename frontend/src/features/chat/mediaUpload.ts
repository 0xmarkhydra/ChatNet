// Upload to presigned S3 storage with transport progress.
// A failed cross-origin PUT can be retried through a same-origin dev proxy or
// an authenticated backend relay; neither sends app credentials to S3.
export function uploadPresignedFile(
  url: string,
  file: File,
  contentType: string,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
  options: { uploadThroughAPI?: () => Promise<void>; devFallbackUrl?: string } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Đã hủy tải tệp.', 'AbortError'))
      return
    }
    let settled = false
    let xhr: XMLHttpRequest | null = null
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const complete = (error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const onAbort = () => {
      xhr?.abort()
      complete(new DOMException('Đã hủy tải tệp.', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    const networkError = () => new Error(
      'Không thể tải ' + file.name + ' lên kho lưu trữ. Kiểm tra kết nối mạng hoặc cấu hình CORS S3.',
    )

    function retryThroughAPI() {
      if (!options.uploadThroughAPI) {
        complete(networkError())
        return
      }
      onProgress(0)
      void options.uploadThroughAPI()
        .then(() => {
          if (signal.aborted) return complete(new DOMException('Đã hủy tải tệp.', 'AbortError'))
          onProgress(file.size)
          complete()
        })
        .catch(reason => complete(reason instanceof Error ? reason : networkError()))
    }

    function start(target: string, stage: 'direct' | 'dev') {
      if (signal.aborted) return complete(new DOMException('Đã hủy tải tệp.', 'AbortError'))
      const current = new XMLHttpRequest()
      xhr = current
      current.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.min(file.size, event.loaded))
      }
      current.onload = () => {
        if (current.status >= 200 && current.status < 300) {
          onProgress(file.size)
          complete()
        } else {
          complete(new Error(
            'Kho lưu trữ từ chối upload ' + file.name + ' (HTTP ' + current.status + '). Kiểm tra quyền bucket hoặc chữ ký URL.',
          ))
        }
      }
      current.onerror = () => {
        if (stage === 'direct' && options.devFallbackUrl) {
          onProgress(0)
          start(options.devFallbackUrl, 'dev')
        } else {
          retryThroughAPI()
        }
      }
      current.ontimeout = () => complete(new Error('Upload ' + file.name + ' quá thời gian cho phép.'))
      current.onabort = () => complete(new DOMException('Đã hủy tải tệp.', 'AbortError'))
      try {
        current.open('PUT', target)
        current.timeout = 120_000
        current.withCredentials = false
        current.setRequestHeader('Content-Type', contentType)
        current.send(file)
      } catch (error) {
        complete(error instanceof Error ? error : new Error('Không thể bắt đầu upload'))
      }
    }

    start(url, 'direct')
  })
}
