import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getDesktopScreenshotBridge, type DesktopScreenshotMode } from '../../platform/desktop'
import type { Notice } from '../../shared/types/api'

export function useDesktopScreenshot(notice: Notice) {
  const bridge = getDesktopScreenshotBridge()
  const [busy, setBusy] = useState(false)
  const active = useRef<object | null>(null)

  useLayoutEffect(() => () => { active.current = null }, [])

  const capture = useCallback(async (mode: DesktopScreenshotMode) => {
    if (!bridge || active.current) return
    const request = {}
    active.current = request
    setBusy(true)
    try {
      const copied = await bridge.capture(mode)
      if (active.current === request && copied) notice('Đã sao chép ảnh chụp. Dùng Ctrl+V để dán.', 'success')
    } catch {
      if (active.current === request) notice('Không chụp được màn hình. Hãy thử lại.', 'error')
    } finally {
      if (active.current === request) {
        active.current = null
        setBusy(false)
      }
    }
  }, [bridge, notice])

  useEffect(() => bridge?.onShortcut((mode) => { void capture(mode) }), [bridge, capture])

  return { busy, captureWithoutWindow: bridge ? () => { void capture('exclude') } : undefined }
}
