import { useState, useEffect, type FormEvent } from 'react'
import { API } from '../../shared/lib/config'
import { parseSession, type Session } from './session'

type AuthMode = 'login' | 'register'
type RegisterStep = 'details' | 'otp'

export function useAuthFlow(saveSession: (next: Session) => void) {
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details')
  const [authEmail, setAuthEmail] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(0)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await fetch(`${API}/api/auth/email/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(result.error || 'Không thể gửi mã xác minh')
        return
      }

      const payload = result as {
        verificationToken: string
        emailMasked: string
        expiresInSeconds: number
      }
      setVerificationToken(payload.verificationToken)
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
      setRegisterStep('otp')
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  async function verifyOTP(event: FormEvent) {
    event.preventDefault()
    if (!verificationToken || otpCode.length !== 6) return

    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch(`${API}/api/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationToken,
          code: otpCode,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(result.error || 'Mã xác minh không đúng')
        return
      }

      const next = parseSession(result)
      if (!next) throw new Error('invalid session response')
      saveSession({ ...next, sessionId: crypto.randomUUID() })
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  async function resendOTP() {
    if (!verificationToken) return

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
        setAuthError(result.error || 'Không thể gửi lại mã')
        return
      }
      const payload = result as {
        verificationToken: string
        emailMasked: string
        expiresInSeconds: number
      }
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  function resetRegistration() {
    setRegisterStep('details')
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
      const left = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000))
      setOtpSecondsLeft(left)
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [registerStep, otpExpiresAt])

  return { authMode, setAuthMode, registerStep, authEmail, setAuthEmail, verificationEmail, otpCode, setOtpCode, otpSecondsLeft, authError, authLoading, submitAuth, verifyOTP, resendOTP, resetRegistration }
}
