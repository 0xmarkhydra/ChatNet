import { createUiTranslator } from '@/shared/i18n/locale'
import { APP_LOCALES, APP_LOCALE_LABELS, type AppLocale } from '@/shared/i18n/supportedLocales'
import { useState } from 'react'
import { Bell, Camera, Check, ChevronLeft, Languages, MapPin, Mic, ShieldCheck } from 'lucide-react'
import { saveAppLocalePreference } from '../../i18n'

type Permission = 'microphone' | 'camera' | 'notification' | 'location'
type PermissionState = 'granted' | 'denied' | 'unsupported'
const stages = ['common.language', 'common.notifications', 'auth.devicePermission'] as const

export default function AuthSetup({ locale, onLocaleChange, onComplete }: { locale: AppLocale; onLocaleChange: (locale: AppLocale) => void; onComplete: (locale: string) => void }) {
  const [stage, setStage] = useState(0)
  const trUi = createUiTranslator(locale)
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
      setError(trUi('auth.permissionDenied'))
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
    <section className="auth-card auth-setup" aria-label={trUi("auth.setup")}>
      <div className="auth-setup-heading">
        <h2>{trUi("auth.setup")}</h2>
        <p>{trUi('auth.setupPermission')}</p>
      </div>
      <div className="auth-setup-progress" aria-label={trUi("auth.setupSteps")}>
        {stages.map((label, index) => (
          <div key={label} className={index === stage ? 'is-current' : index < stage ? 'is-complete' : ''}>
            <span className="auth-step-number">{index < stage ? <Check size={13} /> : index + 1}</span>
            <span>{trUi(label)}</span>
          </div>
        ))}
      </div>

      {stage === 0 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><Languages size={19} /><h3>{trUi("auth.displayLanguage")}</h3></div>
          <p>{trUi('auth.setupLanguageHint')}</p>
          <div className="auth-language-list" role="group" aria-label={trUi("auth.chooseLanguage")}>
            {APP_LOCALES.map(value => (
              <label key={value} className={locale === value ? 'is-selected' : ''}>
                <span><strong>{APP_LOCALE_LABELS[value]}</strong></span>
                <input type="radio" name="setup-language" value={value} checked={locale === value} onChange={() => onLocaleChange(value)} />
              </label>
            ))}
          </div>
        </div>
      )}

      {stage === 1 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><Bell size={19} /><h3>{trUi('auth.setupNotificationTitle')}</h3></div>
          <p>{trUi('auth.setupNotificationHint')}</p>
          <div className="auth-notification-box">
            <span className="auth-permission-icon"><Bell size={24} /></span>
            <div><strong>{trUi("auth.deviceNotice")}</strong><small>{permissions.notification === 'granted' ? trUi('auth.notificationGranted') : trUi('auth.notificationPrompt')}</small></div>
          </div>
          <button className="auth-outline-button" type="button" disabled={busy !== null || permissions.notification === 'granted'}
            onClick={() => void requestPermission('notification')}>
            {permissions.notification === 'granted' ? trUi('common.grant') : trUi('auth.allowNotifications')}
          </button>
          <p className="auth-permission-note">{trUi('auth.pushHint')}</p>
        </div>
      )}

      {stage === 2 && (
        <div className="auth-setup-body">
          <div className="auth-setup-title"><ShieldCheck size={19} /><h3>{trUi("auth.devicePermission")}</h3></div>
          <p>{trUi('auth.permissionHint')}</p>
          <div className="auth-permissions-list">
            {([
              ['microphone', Mic, 'Microphone', trUi('auth.microphoneHint'), trUi('auth.whenUsed')],
              ['camera', Camera, 'Camera', trUi('auth.cameraHint'), trUi('auth.whenUsed')],
              ['notification', Bell, trUi('common.notifications'), trUi('auth.notificationHint'), trUi('common.later')],
              ['location', MapPin, trUi('common.location'), trUi('auth.locationHint'), trUi('common.later')],
            ] as const).map(([key, Icon, name, hint, defaultLabel]) => (
              <div className="auth-permission-row" key={key}>
                <span className="auth-permission-icon"><Icon size={20} /></span>
                <div className="auth-permission-text"><strong>{name}</strong><small>{hint}</small></div>
                <button type="button" aria-label={trUi("auth.permissionAria", { name, when: defaultLabel.toLowerCase() })}
                  disabled={busy !== null || permissions[key] === 'granted'}
                  onClick={() => void requestPermission(key)}>
                  {permissions[key] === 'granted' ? trUi('common.granted') : permissions[key] === 'denied' ? trUi("common.retry") : permissions[key] === 'unsupported' ? trUi('common.unsupported') : trUi("calls.grantPermission")}
                </button>
              </div>
            ))}
          </div>
          {error && <p className="auth-setup-error" role="alert">{error}</p>}
        </div>
      )}

      <div className="auth-setup-actions">
        {stage > 0 && <button className="auth-outline-button" type="button" onClick={() => setStage(stage - 1)}><ChevronLeft size={16} />{trUi("common.back")}</button>}
        <button className="auth-setup-skip" type="button" onClick={finish}>{trUi("common.later")}</button>
        <button className="auth-submit" type="button" onClick={() => stage === 2 ? finish() : setStage(stage + 1)}>
          <Check size={17} /> <span>{stage === 2 ? trUi('auth.setupDone') : trUi("common.next")}</span>
        </button>
      </div>
    </section>
  )
}