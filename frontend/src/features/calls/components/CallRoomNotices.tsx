import { Mic, Sparkles } from 'lucide-react'
import { isDesktopBuild } from '../../../platform/desktop'

type CallRoomNoticesProps = {
  mediaPermissionError: string
  mediaType: 'audio' | 'video'
  roomConnected: boolean
  permissionRetrying: boolean
  requestCallMediaPermission: () => void
  consentError: string
  consentRequested: boolean
  allowMyVoice: boolean
  consentBusy: boolean
  updateVoiceConsent: (allowed: boolean) => void
  dismissConsent: () => void
}

export default function CallRoomNotices({ mediaPermissionError, mediaType, roomConnected, permissionRetrying, requestCallMediaPermission, consentError, consentRequested, allowMyVoice, consentBusy, updateVoiceConsent, dismissConsent }: CallRoomNoticesProps) {
  return (
    <>
        {mediaPermissionError && (
          <div className="call-permission-prompt" role="alert">
            <div className="call-notice-icon"><Mic size={18} /></div>
            <div className="call-notice-copy">
              <strong>Cần quyền micro{mediaType === 'video' ? ' / camera' : ''}</strong>
              <span>{mediaPermissionError} {isDesktopBuild ? 'Nếu đã chặn, hãy bật quyền SocCO trong cài đặt quyền riêng tư của hệ điều hành.' : 'Nếu đã chặn, hãy bật quyền trong cài đặt trình duyệt.'}</span>
            </div>
            <button type="button" disabled={!roomConnected || permissionRetrying}
              onClick={() => void requestCallMediaPermission()}>
              Cấp quyền
            </button>
          </div>
        )}
        {consentError && <div className="call-global-error" role="alert">{consentError}</div>}
        {consentRequested && !allowMyVoice && (
          <div className="call-translation-consent-prompt" role="alert">
            <div className="call-notice-icon"><Sparkles size={18} /></div>
            <div className="call-notice-copy">
              <strong>Cho phép dịch giọng nói?</strong>
              <span>Chỉ áp dụng cuộc gọi này. Người nghe có thể gửi giọng nói của bạn tới máy chủ ChatNet và Google Gemini để dịch.</span>
            </div>
            <div className="call-consent-actions">
              <button type="button" disabled={consentBusy} onClick={() => void updateVoiceConsent(true)}>Cho phép</button>
              <button type="button" className="call-consent-decline" disabled={consentBusy} onClick={() => dismissConsent()}>Để sau</button>
            </div>
          </div>
        )}
    </>
  )
}
