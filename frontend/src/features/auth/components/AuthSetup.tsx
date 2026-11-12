import { useState } from 'react'
import { Bell, Camera, Check, ChevronLeft, Languages, MapPin, Mic, ShieldCheck } from 'lucide-react'
import { loadAppLocalePreference, saveAppLocalePreference } from '../../i18n/lib/i18n'

type Permission = 'microphone' | 'camera' | 'notification' | 'location'
type PermissionState = 'granted' | 'denied' | 'unsupported'
const stages = ['Ngôn ngữ', 'Thông báo', 'Quyền thiết bị'] as const

export default function AuthSetup({ onComplete }: { onComplete: (locale: string) => void }) {
  const [stage, setStage] = useState(0)
  const [locale, setLocale] = useState(() => {
    try { return loadAppLocalePreference() } catch { return 'auto' }
  })
  const [permissions, setPermissions] = useState<Partial<Record<Permission, PermissionState>>>({})
  const [busy, setBusy] = useState<Permission | null>(null)
  const [error, setError] = useState('')

  async function requestPermission(permission: Permission) {
    if (busy) return
    setBusy(permission)
    setError('')
    let status: PermissionState = 'unsupported'
    try {
      if (permission === 'notification') {
        if ('Notification' in window && typeof Notification.requestPermission === 'function') {
          status = (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied'
        }
      } else if (permission === 'location') {
        if ('geolocation' in navigator) {
          await new Promise<void>((resolve, reject) => navigator.geolocation.getCurrentPosition(
            () => resolve(),
            reject,
            { timeout: 10000 },
          ))
          status = 'granted'
        }
      } else if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: permission === 'microphone', video: permission === 'camera',
        })
        stream.getTracks().forEach((track) => track.stop())
        status = 'granted'
      }
    } catch {
      status = 'denied'
      setError('Không thể cấp quyền. Bạn vẫn có thể tiếp tục và bật quyền sau trong trình duyệt.')
    } finally {
      setPermissions((current) => ({ ...current, [permission]: status }))
      setBusy(null)
    }
  }

  function finish() {
    try { saveAppLocalePreference(locale) } catch { /* Storage is optional for continuing. */ }
    onComplete(locale)
  }

  return (
    <section className="auth-card auth-setup" aria-label="Thiết lập ban đầu">
      <div className="auth-setup-heading">
        <h2>Thiết lập ban đầu</h2>
        <p>Chỉ những quyền cần thiết mới được yêu cầu khi bạn sử dụng.</p>
      </div>
      <div className="auth-setup-progress" aria-label="Các bước thiết lập">
        {stages.map((label, index) => (
          <div key={label} className={index === stage ? 'is-current' : index < stage ? 'is-complete' : ''}>
            <span className="auth-step-number">{index < stage ? <Check size={13} /> : index + 1}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {stage === 0 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><Languages size={19} /><h3>Ngôn ngữ hiển thị</h3></div>
          <p>Chọn ngôn ngữ bạn muốn sử dụng trên SocCo. Bạn có thể đổi trong cài đặt.</p>
          <div className="auth-language-list" role="group" aria-label="Chọn ngôn ngữ">
            {([
              ['auto', 'Theo thiết bị', 'Tự động theo ngôn ngữ trình duyệt'],
              ['vi', 'Tiếng Việt', 'Giao diện tiếng Việt'],
              ['en', 'English', 'English interface'],
            ] as const).map(([value, label, description]) => (
              <label key={value} className={locale === value ? 'is-selected' : ''}>
                <span><strong>{label}</strong><small>{description}</small></span>
                <input type="radio" name="setup-language" value={value} checked={locale === value} onChange={() => setLocale(value)} />
              </label>
            ))}
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><Bell size={19} /><h3>Không bỏ lỡ cuộc trò chuyện</h3></div>
          <p>SocCo có thể thông báo khi bạn có tin nhắn hoặc cuộc gọi mới. Bạn có thể bật thông báo sau trong ứng dụng.</p>
          <div className="auth-notification-box">
            <span className="auth-permission-icon"><Bell size={24} /></span>
            <div><strong>Thông báo trên thiết bị</strong><small>{permissions.notification === 'granted' ? 'Trình duyệt đã cấp quyền thông báo.' : 'Chỉ hỏi quyền nếu bạn nhấn nút bên dưới.'}</small></div>
          </div>
          <button className="auth-outline-button" type="button" disabled={busy !== null || permissions.notification === 'granted'}
            onClick={() => void requestPermission('notification')}>
            {permissions.notification === 'granted' ? 'Đã cấp quyền' : 'Cho phép thông báo'}
          </button>
          <p className="auth-permission-note">Đăng ký nhận push sẽ được hoàn tất trong phần cài đặt thông báo của ứng dụng.</p>
        </div>
      )}

      {stage === 2 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><ShieldCheck size={19} /><h3>Quyền thiết bị</h3></div>
          <p>Bạn có thể thay đổi các quyền này bất kỳ lúc nào trong trình duyệt.</p>
          <div className="auth-permissions-list">
            {([
              ['microphone', Mic, 'Microphone', 'Dùng khi ghi âm hoặc gọi thoại', 'Khi dùng'],
              ['camera', Camera, 'Camera', 'Dùng khi gọi video hoặc quét QR', 'Khi dùng'],
              ['notification', Bell, 'Thông báo', 'Nhận tin nhắn và cuộc gọi mới', 'Để sau'],
              ['location', MapPin, 'Vị trí', 'Chỉ dùng khi khám phá gần đây', 'Để sau'],
            ] as const).map(([key, Icon, name, hint, defaultLabel]) => (
              <div className="auth-permission-row" key={key}>
                <span className="auth-permission-icon"><Icon size={20} /></span>
                <div className="auth-permission-text"><strong>{name}</strong><small>{hint}</small></div>
                <button type="button" aria-label={`Cấp quyền ${name} (${defaultLabel.toLowerCase()})`}
                  disabled={busy !== null || permissions[key] === 'granted'}
                  onClick={() => void requestPermission(key)}>
                  {permissions[key] === 'granted' ? 'Đã cấp' : permissions[key] === 'denied' ? 'Thử lại' : permissions[key] === 'unsupported' ? 'Không hỗ trợ' : 'Cấp quyền'}
                </button>
              </div>
            ))}
          </div>
          {error && <p className="auth-setup-error" role="alert">{error}</p>}
        </div>
      )}

      <div className="auth-setup-actions">
        {stage > 0 && <button className="auth-outline-button" type="button" onClick={() => setStage(stage - 1)}><ChevronLeft size={16} /> Quay lại</button>}
        <button className="auth-setup-skip" type="button" onClick={finish}>Để sau</button>
        <button className="auth-submit" type="button" onClick={() => stage === 2 ? finish() : setStage(stage + 1)}>
          <Check size={17} /> <span>{stage === 2 ? 'Hoàn tất thiết lập' : 'Tiếp tục'}</span>
        </button>
      </div>
    </section>
  )
}