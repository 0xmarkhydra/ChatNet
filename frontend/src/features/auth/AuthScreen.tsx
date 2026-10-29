import type { useAuthFlow } from './useAuthFlow'

type Props = ReturnType<typeof useAuthFlow>

export default function AuthScreen({
  authMode,
  setAuthMode,
  registerStep,
  authEmail,
  setAuthEmail,
  verificationEmail,
  otpCode,
  setOtpCode,
  otpSecondsLeft,
  authError,
  authLoading,
  submitAuth,
  verifyOTP,
  resendOTP,
  resetRegistration,
}: Props) {
  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <img src="/soco-mark.svg" width="52" height="52" alt="SOCO" />
        <h1>SOCO</h1>
        <p>Understand. Connect. Together.</p>
      </section>

      {registerStep === 'otp' ? (
        <form className="auth-card otp-card" onSubmit={verifyOTP}>
          <div className="otp-icon">✉️</div>
          <h2>Kiểm tra email của bạn</h2>
          <p className="auth-hint">
            SOCO đã gửi mã xác minh 6 số tới <strong>{verificationEmail || 'email của bạn'}</strong>.
            Mã có hiệu lực trong 10 phút.
          </p>

          <label>
            Mã xác minh
            <input
              className="otp-input"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoFocus
              required
            />
          </label>

          <div className="otp-meta">
            <span>
              {otpSecondsLeft > 0
                ? `Hết hạn sau ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')}`
                : 'Mã đã hết hạn'}
            </span>
            <button type="button" onClick={() => void resendOTP()} disabled={authLoading}>
              Gửi lại mã
            </button>
          </div>

          {authError && <div className="auth-error">{authError}</div>}
          <button className="auth-submit" disabled={authLoading || otpCode.length !== 6 || otpSecondsLeft <= 0}>
            {authLoading ? 'Đang xác minh...' : 'Xác minh & vào SOCO'}
          </button>
          <button type="button" className="auth-secondary" onClick={resetRegistration} disabled={authLoading}>
            Dùng email khác
          </button>
        </form>
      ) : (
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              disabled={authLoading}
              onClick={() => {
                setAuthMode('register')
                resetRegistration()
              }}
            >
              Đăng ký
            </button>
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              disabled={authLoading}
              onClick={() => {
                setAuthMode('login')
                resetRegistration()
              }}
            >
              Đăng nhập
            </button>
          </div>

          <h2>{authMode === 'register' ? 'Tạo tài khoản' : 'Chào mừng quay lại'}</h2>
          <label>
            Email
            <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required />
          </label>

          {authMode === 'register' && (
            <div className="email-verify-note">
              🔐 Tài khoản chỉ được tạo sau khi bạn nhập đúng OTP gửi qua email.
            </div>
          )}

          {authError && <div className="auth-error">{authError}</div>}
          <button className="auth-submit" disabled={authLoading}>
            {authLoading
              ? 'Đang xử lý...'
              : authMode === 'register'
                ? 'Gửi mã OTP'
                : 'Đăng nhập'}
          </button>
        </form>
      )}
    </main>
  )
}
