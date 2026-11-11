import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  Languages,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react'
import { isDesktopBuild } from '../../../platform/desktop'
import type { useAuthFlow } from '../hooks/useAuthFlow'
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
      <div className="auth-bg-ambient" aria-hidden="true">
        <div className="auth-bg-gradient" />
        <div className="auth-orb auth-orb--blue" />
        <div className="auth-orb auth-orb--purple" />
      </div>

      <aside className="auth-hero">
        <div className="auth-brand">
          <div className="auth-brand-identity">
            <div className="auth-brand-logo-wrap">
              <svg className="auth-logo-svg" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <linearGradient id="soco_logo_grad" x1="6%" x2="98%" y1="20%" y2="90%">
                    <stop offset="0%" stopColor="#126df7" />
                    <stop offset="34%" stopColor="#0988f5" />
                    <stop offset="67%" stopColor="#8b5cf6" />
                    <stop offset="84%" stopColor="#ef4dbb" />
                    <stop offset="100%" stopColor="#ff9f0e" />
                  </linearGradient>
                </defs>
                <rect fill="#ffffff" height="96" rx="24" width="96" />
                <path
                  d="M71 24C62 17 48 15 34 19C19 23 15 40 27 47C39 54 61 50 66 63C71 75 51 83 34 77C26 74 21 71 17 67"
                  fill="none"
                  stroke="url(#soco_logo_grad)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="15"
                />
              </svg>
            </div>
            <div className="auth-brand-meta">
              <div className="auth-brand-title-row">
                <strong>SocCo</strong>
                <span className="auth-online-dot" aria-hidden="true" />
              </div>
              <p className="auth-brand-sub">Mạng xã hội đa ngôn ngữ & Kết nối thời gian thực</p>
            </div>
          </div>
          <div className="auth-brand-signal">
            <span className="auth-pulse-dot" aria-hidden="true" />
            <span>120K+ người dùng năng động</span>
          </div>
        </div>

        <div className="auth-hero-content">
          {isOTP ? (
            <div className="auth-state-hero">
              <span className="auth-hero-symbol"><ShieldCheck size={28} strokeWidth={1.8} /></span>
              <h1>Kết nối an toàn hơn</h1>
              <p>Xác thực tài khoản để tiếp tục trò chuyện và kết nối.</p>
            </div>
          ) : isSetup ? (
            <div className="auth-state-hero">
              <span className="auth-hero-symbol"><MessageCircle size={29} strokeWidth={1.8} /></span>
              <h1>Cùng nhau kết nối</h1>
              <p>Thiết lập trải nghiệm phù hợp với bạn.</p>
            </div>
          ) : (
            <div className="auth-showcase-grid">
              <div className="auth-showcase-copy">
                <div className="auth-badge-pill">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Next-Gen Global Social Community</span>
                </div>
                <h1>
                  Understand.<br />
                  <span className="auth-gradient-text">Connect.</span><br />
                  Together.
                </h1>
                <p>Khám phá nguồn cấp dữ liệu thông minh, phá vỡ rào cản ngôn ngữ bằng AI dịch tức thì và kết nối triệu trái tim trên toàn cầu.</p>
                <div className="auth-feature-icons" aria-hidden="true">
                  <span className="auth-feature-icon auth-feature-icon--blue"><Languages size={18} /></span>
                  <span className="auth-feature-icon auth-feature-icon--emerald"><Zap size={18} /></span>
                  <span className="auth-feature-icon auth-feature-icon--pink"><Heart size={18} /></span>
                </div>
              </div>

              <div className="auth-hero-visual">
                <div className="auth-hero-halo" aria-hidden="true" />
                <div className="auth-hero-rings" aria-hidden="true">
                  <div className="auth-ring auth-ring--outer" />
                  <div className="auth-ring auth-ring--inner" />
                </div>

                <img
                  src="/login-hero.png"
                  alt="SocCo Member"
                  className="auth-hero-img"
                />

                {/* Floating Social & Feature Badges */}
                <div className="auth-float-badge auth-float-badge--chat" aria-hidden="true">
                  <MessageCircle size={20} color="#ffffff" />
                </div>
                <div className="auth-float-badge auth-float-badge--heart" aria-hidden="true">
                  <Heart size={18} color="#ffffff" fill="#ffffff" />
                </div>
                <div className="auth-float-badge auth-float-badge--lang" aria-hidden="true">
                  <Languages size={18} color="#ffffff" />
                </div>

                {/* Floating Chat Bubble */}
                <div className="auth-float-bubble auth-float-bubble--msg" aria-hidden="true">
                  <Sparkles size={13} className="auth-bubble-sparkle" />
                  <span>AI dịch tức thì: 50+ ngôn ngữ</span>
                </div>

                {/* Preserved Floating Metrics Cards */}
                <div className="auth-floating-card auth-floating-card--top">
                  <div className="auth-floating-icon auth-floating-icon--green">
                    <TrendingUp size={16} />
                  </div>
                  <div className="auth-floating-copy">
                    <strong>120K+ Tương tác</strong>
                    <small>Đa văn hóa toàn cầu</small>
                  </div>
                </div>
                <div className="auth-floating-card auth-floating-card--bottom">
                  <div className="auth-floating-icon auth-floating-icon--blue">
                    <MessageSquare size={18} />
                  </div>
                  <div className="auth-floating-copy">
                    <strong>24/7 AI Tương tác</strong>
                    <small>Hỗ trợ kết nối tức thì</small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="auth-hero-footer">
          <span>© SocCo • ChatNet</span>
          <div className="auth-footer-links">
            <a href="#privacy">Quyền riêng tư</a>
            <span aria-hidden="true">•</span>
            <a href="#terms">Điều khoản</a>
            <span aria-hidden="true">•</span>
            <a href="#support">Hỗ trợ</a>
          </div>
        </div>
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
              <Check size={18} /> <span>Xác minh và tiếp tục</span>
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
              <h2>{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản SocCo'}</h2>
              <p>{authMode === 'login' ? 'Đăng nhập để khám phá cộng đồng SocCo.' : 'Bắt đầu kết nối cùng mọi người qua email.'}</p>
            </div>
            <div className={`auth-tabs auth-tabs--${authMode}`} role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
              <button type="button" className={authMode === 'login' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('login')}>Đăng nhập</button>
              <button type="button" className={authMode === 'register' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('register')}>Tạo tài khoản</button>
            </div>
            <label className="auth-field" htmlFor="auth-email">Email
              <input id="auth-email" type="email" value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@example.com"
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
                    <span>Ghi nhớ email</span>
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
              <span>{authLoading ? (usingPassword ? 'Đang đăng nhập...' : 'Đang gửi...') : authMode === 'register' ? 'Gửi mã xác minh' : usingPassword ? 'Đăng nhập' : 'Gửi mã OTP'}</span>
              <ArrowRight size={18} />
            </button>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">Hoặc</span>
              <span className="auth-divider-line" />
            </div>

            <div className="auth-secondary-actions">
              {authMode === 'login' && !isDesktopBuild && (
                <button type="button" className="auth-action-btn" onClick={() => { setLoginMethod(usingPassword ? 'otp' : 'password'); resetRegistration() }}>
                  <Smartphone size={16} />
                  <span>{usingPassword ? 'Đăng nhập bằng mã OTP qua email' : 'Đăng nhập bằng mật khẩu'}</span>
                </button>
              )}
              <button
                type="button"
                className="auth-action-btn auth-google-btn"
                onClick={() => {
                  /* Google OAuth integration placeholder */
                  submitAuth(new Event('submit') as unknown as React.FormEvent)
                }}
              >
                <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>Đăng nhập bằng Google</span>
              </button>
            </div>

            <div className="auth-login-bottom">
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
