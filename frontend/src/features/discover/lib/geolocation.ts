type BrowserGeoError = {
  code?: unknown
  message?: unknown
}

function browserName() {
  const agent = navigator.userAgent
  if (/Edg\//.test(agent)) return 'Microsoft Edge'
  if (/Chrome\//.test(agent) && !/Edg\//.test(agent)) return 'Google Chrome'
  if (/Safari\//.test(agent) && !/Chrome\//.test(agent)) return 'Safari'
  if (/Firefox\//.test(agent)) return 'Firefox'
  return 'trình duyệt'
}

async function geolocationPermissionState(): Promise<PermissionState | 'unknown'> {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

function getPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getCurrentPositionSmart(): Promise<GeolocationPosition> {
  if (!window.isSecureContext) {
    throw new Error('ChatNet cần HTTPS để dùng vị trí.')
  }
  if (!navigator.geolocation) {
    throw new Error('Trình duyệt không hỗ trợ định vị.')
  }

  const permission = await geolocationPermissionState()
  if (permission === 'denied') {
    const error = new Error('Browser geolocation permission is denied') as Error & { code?: number }
    error.code = 1
    throw error
  }

  try {
    return await getPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
  } catch (error) {
    const code = Number((error as BrowserGeoError | null)?.code || 0)
    if (code !== 2 && code !== 3) throw error

    // A Mac can fail high-accuracy positioning even while Location Services is enabled.
    // Retry once with a cached/network-assisted position before surfacing an error.
    return getPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    })
  }
}

export async function geolocationErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return 'Không thể dùng định vị vì trang chưa chạy trong HTTPS an toàn. Hãy mở https://chat.codelocal.cloud rồi thử lại.'
  }

  const geoError = error as BrowserGeoError | null
  const code = typeof geoError?.code === 'number' ? geoError.code : 0
  const browserMessage =
    typeof geoError?.message === 'string' && geoError.message.trim()
      ? geoError.message.trim().slice(0, 180)
      : ''
  const permission = await geolocationPermissionState()
  const browser = browserName()
  const detail = browserMessage ? ` Chi tiết: ${browserMessage}` : ''

  if (code === 1 || permission === 'denied') {
    return `${browser} đang báo quyền vị trí bị từ chối (GPS 1), dù macOS có thể đã bật Location Services. Hãy kiểm tra cả 2 lớp quyền: macOS → Privacy & Security → Location Services → bật cho ${browser}; sau đó trong ${browser}, mở quyền của chat.codelocal.cloud → Location → Allow. Nếu đều đã bật, hãy chuyển quyền trang về Ask/Reset, tải lại trang rồi cấp lại quyền.${detail}`
  }
  if (code === 2) {
    return `Máy chưa xác định được vị trí (GPS 2). ChatNet đã thử cả chế độ chính xác cao và định vị mạng nhưng vẫn thất bại. Hãy bật Wi‑Fi, kiểm tra Location Services cho ${browser}, rồi thử lại.${detail}`
  }
  if (code === 3) {
    return `Lấy vị trí quá thời gian (GPS 3). Hãy bật Wi‑Fi và thử lại; ChatNet sẽ tự dùng vị trí gần nhất nếu trình duyệt có cache hợp lệ.${detail}`
  }

  if (error instanceof Error && error.message) return error.message
  return `Không lấy được vị trí. Hãy kiểm tra quyền Location của ${browser} và thử lại.${detail}`
}
