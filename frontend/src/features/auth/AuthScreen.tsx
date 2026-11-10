import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Languages, LockKeyhole, Mail, MessageCircle, ShieldCheck, Video } from 'lucide-react'
import { isDesktopBuild } from '../../platform/desktop'
import type { useAuthFlow } from './useAuthFlow'
import AuthSetup from './AuthSetup'

type Props = ReturnType<typeof useAuthFlow>

export default function AuthScreen({
  authMode, setAuthMode, loginMethod, setLoginMethod, registerStep,
  authEmail, setAuthEmail, authPassword, setAuthPassword, rememberEmail, setRememberEmail,
  verificationEmail, otpCode, setOtpCode, otpSecondsLeft, authError, authLoading,
  submitAuth, verifyOTP, resendOTP, resetRegistration, finishSetup,
}: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const isOTP = registerStep === 'otp'
  const isSetup = registerStep === 'setup'
  const usingPassword = !isDesktopBuild && authMode === 'login' && loginMethod === 'password'
  const switchMode = (next: 'login' | 'register') => {
    setAuthMode(next)
    resetRegistration()
  }

  return (
    <main className={`auth-layout ${isOTP || isSetup ? 'auth-layout--secondary' : 'auth-layout--login'}`}>
      <aside className="auth-hero">
        <div className="auth-brand">
          {!isOTP && !isSetup && <span className="auth-brand-mark">S</span>}
          <strong>SocCo</strong>
        </div>

        <div className="auth-hero-content">
          {isOTP ? (
            <>
              <span className="auth-hero-symbol"><ShieldCheck size={28} strokeWidth={1.8} /></span>
              <h1>Kết nối an toàn hơn</h1>
              <p>Xác thực tài khoản để tiếp tục trò chuyện và kết nối.</p>
            </>
          ) : isSetup ? (
            <>
              <span className="auth-hero-symbol"><MessageCircle size={29} strokeWidth={1.8} /></span>
              <h1>Cùng nhau kết nối</h1>
              <p>Thiết lập trải nghiệm phù hợp với bạn.</p>
            </>
          ) : (
            <>
              <div className="auth-orb auth-orb--one" aria-hidden="true" />
              <div className="auth-orb auth-orb--two" aria-hidden="true" />
              <h1>Understand. Connect. Together.</h1>
              <p>Kết nối với mọi người, chia sẻ khoảnh khắc và trò chuyện không giới hạn ngôn ngữ.</p>
              <div className="auth-feature-list">
                <div><Languages size={20} /><span>Dịch AI trong tin nhắn và cuộc gọi</span></div>
                <div><Video size={20} /><span>Nhắn tin, gọi video và khám phá cộng đồng</span></div>
              </div>
            </>
          )}
        </div>
        <p className="auth-hero-footer">
          {isOTP ? 'Mã xác thực chỉ dùng một lần và có thời hạn.' : isSetup ? 'Quyền truy cập luôn do bạn kiểm soát.' : '© SocCo · ChatNet'}
        </p>
      </aside>

      <section className="auth-content" aria-label={isSetup ? 'Thiết lập ban đầu' : isOTP ? 'Xác thực email' : 'Đăng nhập và đăng ký'}>
        {isSetup ? (
          <AuthSetup onComplete={finishSetup} />
        ) : isOTP ? (
          <form className="auth-card auth-otp-card" onSubmit={verifyOTP}>
            <button type="button" className="auth-back" onClick={resetRegistration} disabled={authLoading} aria-label="Quay về nhập email">
              <ArrowLeft size={20} />
            </button>
            <div className="auth-otp-emblem"><Mail size={26} strokeWidth={1.7} /></div>
            <h2>Xác thực email</h2>
            <p className="auth-otp-description">Mã OTP đã được gửi tới <strong>{verificationEmail || 'email của bạn'}</strong></p>
            <label className="auth-otp-label" htmlFor="auth-otp-code">Nhập mã gồm 6 chữ số</label>
            <div className="auth-code-cells">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className={otpCode.length === index ? 'is-next' : ''} aria-hidden="true">{otpCode[index] || ''}</span>
              ))}
              <input id="auth-otp-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6} pattern="[0-9]{6}" autoFocus required disabled={authLoading}
                aria-label="Nhập mã xác minh 6 chữ số" />
            </div>
            <p className="auth-otp-countdown" aria-live="off">
              {otpSecondsLeft > 0
                ? `Mã có hiệu lực trong ${String(Math.floor(otpSecondsLeft / 60)).padStart(2, '0')}:${String(otpSecondsLeft % 60).padStart(2, '0')}`
                : 'Mã đã hết hạn. Hãy gửi lại mã hoặc dùng email khác.'}
            </p>
            {authError && <div className="auth-alert" role="alert">{authError}</div>}
            <button className="auth-submit" type="submit" disabled={authLoading || otpCode.length !== 6 || otpSecondsLeft <= 0}>
              <Check size={18} /> Xác minh và tiếp tục
            </button>
            <div className="auth-otp-links">
              <button type="button" disabled={authLoading} onClick={() => void resendOTP()}>
                Chưa nhận được mã? <strong>Gửi lại</strong>
              </button>
              <button type="button" disabled={authLoading} onClick={resetRegistration}>Đổi email</button>
            </div>
            <p className="auth-otp-safety"><ShieldCheck size={14} /> Không chia sẻ mã OTP với người khác.</p>
          </form>
        ) : (
          <form className="auth-card auth-login-card" onSubmit={submitAuth}>
            <div className="auth-form-intro">
              <h2>{authMode === 'login' ? 'Chào mừng trở lại 👋' : 'Tạo tài khoản SocCo'}</h2>
              <p>{authMode === 'login' ? 'Đăng nhập để tiếp tục sử dụng SocCo.' : 'Bắt đầu kết nối cùng mọi người qua email.'}</p>
            </div>
            <div className="auth-tabs" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
              <button type="button" className={authMode === 'login' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('login')}>Đăng nhập</button>
              <button type="button" className={authMode === 'register' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('register')}>Tạo tài khoản</button>
            </div>
            <label className="auth-field" htmlFor="auth-email">Email
              <input id="auth-email" type="email" value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com"
                autoComplete="email" maxLength={254} required />
            </label>

            {usingPassword ? (
              <>
                <div className="auth-field">
                  <label htmlFor="auth-password">Mật khẩu</label>
                  <span className="auth-password-wrap">
                    <input id="auth-password" type={showPassword ? 'text' : 'password'}
                      value={authPassword} onChange={(event) => setAuthPassword(event.target.value)}
                      autoComplete="current-password" placeholder="Nhập mật khẩu" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />} <span>{showPassword ? 'Ẩn' : 'Hiển thị'}</span>
                    </button>
                  </span>
                </div>
                <div className="auth-login-options">
                  <label className="auth-remember">
                    <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
                    Ghi nhớ email
                  </label>
                  <button type="button" onClick={() => { setLoginMethod('otp'); resetRegistration() }}>Quên mật khẩu?</button>
                </div>
              </>
            ) : (
              <div className="auth-email-note">
                <LockKeyhole size={18} />
                <span>{authMode === 'register' ? 'Tài khoản được tạo sau khi xác minh OTP gửi tới email của bạn.' : 'Nhập mã OTP được gửi qua email để đăng nhập an toàn. Email mới có thể tạo tài khoản.'}</span>
              </div>
            )}

            {authError && <div className="auth-alert" role="alert">{authError}</div>}
            <button className="auth-submit" type="submit" disabled={authLoading}>
              <ArrowRight size={18} /> {authLoading ? (usingPassword ? 'Đang đăng nhập...' : 'Đang gửi...') : authMode === 'register' ? 'Gửi mã xác minh' : usingPassword ? 'Đăng nhập' : 'Gửi mã OTP'}
            </button>
            <div className="auth-login-bottom">
              {authMode === 'login' && !isDesktopBuild && (
                <button type="button" onClick={() => { setLoginMethod(usingPassword ? 'otp' : 'password'); resetRegistration() }}>
                  {usingPassword ? 'Đăng nhập bằng mã OTP qua email' : 'Đăng nhập bằng mật khẩu'}
                </button>
              )}
              <span>
                {authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
                <button type="button" onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? 'Đăng ký với email' : 'Đăng nhập'}
                </button>
              </span>
            </div>
            <p className="auth-legal">Bằng việc tiếp tục, bạn đồng ý sử dụng SocCo theo chính sách của ứng dụng.</p>
          </form>
        )}
      </section>
    </main>
  )
}