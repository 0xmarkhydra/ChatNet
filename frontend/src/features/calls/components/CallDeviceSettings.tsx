import { useEffect, useRef, useState } from 'react'
import { RoomEvent, type Room } from 'livekit-client'

export default function CallDeviceSettings({ room, micOn, cameraOn }: { room: Room; micOn: boolean; cameraOn: boolean }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [active, setActive] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    let sequence = 0
    const update = async () => {
      const current = ++sequence
      try {
        // Enumerate only: listing settings must not implicitly turn on a capture device.
        const available = await navigator.mediaDevices.enumerateDevices()
        if (!mounted.current || current !== sequence) return
        setDevices(available.filter((item) => item.kind === 'audioinput' || item.kind === 'videoinput'))
        setActive({ audioinput: room.getActiveDevice('audioinput') || '', videoinput: room.getActiveDevice('videoinput') || '' })
      } catch { if (mounted.current) setError('Không đọc được danh sách thiết bị. Kiểm tra quyền rồi mở lại bảng này.') }
    }
    void update()
    const refresh = () => { void update() }
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    room.on(RoomEvent.ActiveDeviceChanged, refresh)
    return () => {
      mounted.current = false
      sequence++
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
      room.off(RoomEvent.ActiveDeviceChanged, refresh)
    }
  }, [room])
  async function select(kind: 'audioinput' | 'videoinput', deviceId: string) {
    if (busy || !devices.some((item) => item.kind === kind && item.deviceId === deviceId)) return
    setBusy(true); setError('')
    try {
      if (!await room.switchActiveDevice(kind, deviceId)) throw new Error('Switch rejected')
      if (mounted.current) setActive((current) => ({ ...current, [kind]: deviceId }))
    } catch { if (mounted.current) setError('Không chuyển được thiết bị. Thiết bị có thể bị ngắt hoặc đang được ứng dụng khác sử dụng.') }
    finally { if (mounted.current) setBusy(false) }
  }
  return <div className="call-device-settings" aria-label="Thiết bị cuộc gọi">
    {(['audioinput', 'videoinput'] as const).map((kind) => <label key={kind}>
      {kind === 'audioinput' ? 'Microphone' : 'Camera'}
      <select value={active[kind] || ''} disabled={busy || (kind === 'audioinput' ? !micOn : !cameraOn)}
        onChange={(event) => void select(kind, event.target.value)}>
        <option value="" disabled>Thiết bị đang dùng</option>
        {devices.filter((item) => item.kind === kind).map((device, index) =>
          <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Thiết bị ${index + 1}`}</option>)}
      </select>
    </label>)}
    <p>Bật mic/camera trước khi chuyển thiết bị tương ứng.</p>
    {error && <p role="alert">{error}</p>}
  </div>
}
