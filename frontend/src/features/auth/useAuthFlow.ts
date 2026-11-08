import { useEffect, useState, type FormEvent } from 'react'
import { API } from '../../shared/lib/config'
import { parseSession, type Session } from './session'
import { desktopBridge, isDesktopBuild } from '../../platform/desktop'

type AuthMode = 'login' | 'register'
type LoginMethod = 'password' | 'otp'
type RegisterStep = 'details' | 'otp' | 'setup'

function describeOtpSendError(error: unknown, fallback: string): string {
  if (typeof error !== 'string' || !error.trim()) return fallback
  if (error === 'we could not send the verification email' || error === 'we could not resend the verification email') {
    return 'Không thể gửi email xác minh. Vui lòng thử lại hoặc liên hệ quản trị viên để kiểm tra dịch vụ gửi email.'
  }
  return error
}

// randomUUID is unavailable in HTTP/LAN mobile previews; getRandomValues
// remains cryptographically secure without requiring a secure context.
function newClientSessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const REMEMBERED_EMAIL_KEY = 'chatnet-remembered-email'
const setupKey = (userId: number) => `chatnet-setup-complete:${userId}`

function rememberedEmail() {
  try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '' } catch { return '' }
}

export function useAuthFlow(saveSession: (next: Session) => void) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(isDesktopBuild ? 'otp' : 'password')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details')
  const [authEmail, setAuthEmail] = useState(rememberedEmail)
  const [authPassword, setAuthPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(rememberedEmail()))
  const [verificationToken, setVerificationToken] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(0)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [pendingSession, setPendingSession] = useState<Session | null>(null)

  function rememberAddress() {
    try {
      if (rememberEmail) localStorage.setItem(REMEMBERED_EMAIL_KEY, authEmail.trim())
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    } catch { /* Private mode may prevent saving the email; login still works. */ }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    if (authLoading) return
    setAuthLoading(true)
    setAuthError('')
    try {
      if (authMode === 'login' && loginMethod === 'password' && !isDesktopBuild) {
        const response = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
        })
        const result = await response.json()
        if (!response.ok) {
          setAuthError(response.status === 401 ? 'Email hoặc mật khẩu không đúng. Bạn cũng có thể đăng nhập bằng OTP.' : result.error || 'Không thể đăng nhập.')
          return
        }
        const next = parseSession(result)
        if (!next) throw new Error('invalid session response')
        rememberAddress()
        setAuthPassword('')
        saveSession(next)
        return
      }

      const response = await fetch(`${API}/api/auth/email/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail.trim() }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(describeOtpSendError(result.error, 'Không thể gửi mã xác minh.'))
        return
      }
      const payload = result as { verificationToken: string; emailMasked: string; expiresInSeconds: number }
      if (!payload.verificationToken || !Number.isFinite(payload.expiresInSeconds)) throw new Error('invalid OTP response')
      setVerificationToken(payload.verificationToken)
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
      setRegisterStep('otp')
    } catch {
      setAuthError('Không thể kết nối hoặc nhận phản hồi từ máy chủ. Hãy thử lại.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function verifyOTP(event: FormEvent) {
    event.preventDefault()
    if (!verificationToken || otpCode.length !== 6 || authLoading || otpSecondsLeft <= 0) return

    setAuthLoading(true)
    setAuthError('')
    try {
      let next: Session
      if (isDesktopBuild) {
        // Native desktop stores refresh credentials in the OS vault, never the renderer.
        next = await desktopBridge().auth.verifyEmail({ token: verificationToken, code: otpCode })
      } else {
        const response = await fetch(`${API}/api/auth/email/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: verificationToken, code: otpCode }),
        })
        const result = await response.json()
        if (!response.ok) {
          setAuthError(result.error || 'Mã xác minh không đúng hoặc đã hết hạn.')
          return
        }
        const parsed = parseSession(result)
        if (!parsed) throw new Error('invalid session response')
        next = { ...parsed, sessionId: newClientSessionId() }
      }

      rememberAddress()
      setOtpCode('')
      let setupComplete = false
      try { setupComplete = localStorage.getItem(setupKey(next.user.id)) === '1' } catch { /* optional */ }
      if (authMode === 'register' && !setupComplete) {
        setPendingSession(next)
        setRegisterStep('setup')
        return
      }
      saveSession(next)
    } catch {
      setAuthError('Không xác minh được. Hãy kiểm tra kết nối và thử lại.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function resendOTP() {
    if (!verificationToken || authLoading) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch(`${API}/api/auth/email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(response.status === 410 ? 'Phiên xác minh đã hết hạn. Hãy dùng email để bắt đầu lại.' : describeOtpSendError(result.error, 'Không thể gửi lại mã.'))
        return
      }
      const payload = result as { verificationToken: string; emailMasked: string; expiresInSeconds: number }
      setVerificationToken(payload.verificationToken)
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
    } catch {
      setAuthError('Không thể kết nối máy chủ để gửi lại mã.')
    } finally {
      setAuthLoading(false)
    }
  }

  function finishSetup(locale: string) {
    if (!pendingSession) return
    try {
      localStorage.setItem(setupKey(pendingSession.user.id), '1')
      // App syncs the chosen locale with server preferences after the session becomes active.
      localStorage.setItem(`chatnet-setup-locale:${pendingSession.user.id}`, locale)
    } catch { /* optional */ }
    saveSession(pendingSession)
    setPendingSession(null)
  }

  function resetRegistration() {
    setRegisterStep('details')
    setPendingSession(null)
    setVerificationToken('')
    setVerificationEmail('')
    setOtpCode('')
    setOtpExpiresAt(0)
    setOtpSecondsLeft(0)
    setAuthError('')
  }

  useEffect(() => {
    if (registerStep !== 'otp' || otpExpiresAt <= 0) return
    const update = () => {
      setOtpSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)))
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [registerStep, otpExpiresAt])

  return {
    authMode, setAuthMode, loginMethod, setLoginMethod, registerStep,
    authEmail, setAuthEmail, authPassword, setAuthPassword, rememberEmail, setRememberEmail,
    verificationEmail, otpCode, setOtpCode, otpSecondsLeft, authError, authLoading,
    submitAuth, verifyOTP, resendOTP, resetRegistration, finishSetup,
  }
}