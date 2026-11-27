import { useEffect, useState } from 'react'
import { UiLocaleContext, createUiTranslator, resolveUiCopyLocale } from '../../../shared/i18n/locale'
import { APP_LOCALES, APP_LOCALE_LABELS, normalizeAppLocale } from '../../../shared/i18n/supportedLocales'
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
import { loadAppLocalePreference, saveAppLocalePreference } from '../../i18n'
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
  const [mobileLocale, setMobileLocale] = useState(() => {
    try { return normalizeAppLocale(loadAppLocalePreference()) } catch { return normalizeAppLocale(null) }
  })
  const locale = resolveUiCopyLocale(mobileLocale)
  const trUi = createUiTranslator(locale)
  const source = createUiTranslator('vi')
  const knownAuthError = (['auth.loginInvalid', 'auth.loginFailed', 'auth.networkFailed', 'auth.otpInvalid', 'auth.verifyFailed', 'auth.verificationExpired', 'auth.invalidResend', 'auth.resendFailed'] as const).find(key => source(key) === authError)
  const displayAuthError = knownAuthError ? trUi(knownAuthError) : authError
  useEffect(() => { document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale }, [locale])
  const isOTP = registerStep === 'otp'
  const isSetup = registerStep === 'setup'
  const usingPassword = !isDesktopBuild && authMode === 'login' && loginMethod === 'password'
  const switchMode = (next: 'login' | 'register') => {
    setAuthMode(next)
    resetRegistration()
  }

  return (
    <UiLocaleContext.Provider value={{ locale }}>
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
              <p className="auth-brand-sub">{trUi("auth.brandSubtitle")}</p>
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
              <h1>{trUi("auth.safeConnect")}</h1>
              <p>{trUi("auth.verifyPrompt")}</p>
            </div>
          ) : isSetup ? (
            <div className="auth-state-hero">
              <span className="auth-hero-symbol"><MessageCircle size={29} strokeWidth={1.8} /></span>
              <h1>{trUi("auth.together")}</h1>
              <p>{trUi("auth.setupPrompt")}</p>
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
                <p>{trUi("auth.hero")}</p>
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
                  <span>{trUi("auth.instantAI")}</span>
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

      </aside>

      <section className="auth-content" aria-label={isSetup ? trUi("auth.setup") : isOTP ? trUi("auth.verifyEmail") : trUi("auth.signInAndUp")}>
        {isSetup ? (
          <AuthSetup locale={mobileLocale} onLocaleChange={next => { setMobileLocale(next); saveAppLocalePreference(next) }} onComplete={finishSetup} />
        ) : isOTP ? (
          <form className="auth-card auth-otp-card" onSubmit={verifyOTP}>
            <button type="button" className="auth-back" onClick={resetRegistration} disabled={authLoading} aria-label={trUi("auth.backEmail")}>
              <ArrowLeft size={20} />
            </button>
            <div className="auth-otp-emblem"><Mail size={26} strokeWidth={1.7} /></div>
            <h2>{trUi("auth.verifyEmail")}</h2>
            <p className="auth-otp-description">{trUi("auth.otpSent") + ' '}<strong>{verificationEmail || trUi("auth.yourEmail")}</strong></p>
            <label className="auth-otp-label" htmlFor="auth-otp-code">{trUi("auth.codeLabel")}</label>
            <div className="auth-code-cells">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className={otpCode.length === index ? 'is-next' : ''} aria-hidden="true">{otpCode[index] || ''}</span>
              ))}
              <input id="auth-otp-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6} pattern="[0-9]{6}" autoFocus required disabled={authLoading}
                aria-label={trUi("auth.codeAria")} />
            </div>
            <p className="auth-otp-countdown" aria-live="off">
              {otpSecondsLeft > 0
                ? trUi('auth.otpTime', { time: `${String(Math.floor(otpSecondsLeft / 60)).padStart(2, '0')}:${String(otpSecondsLeft % 60).padStart(2, '0')}` })
                : trUi("auth.otpExpired")}
            </p>
            {authError && <div className="auth-alert" role="alert">{displayAuthError}</div>}
            <button className="auth-submit" type="submit" disabled={authLoading || otpCode.length !== 6 || otpSecondsLeft <= 0}>
              <Check size={18} /> <span>{trUi("auth.verifyContinue")}</span>
            </button>
            <div className="auth-otp-links">
              <button type="button" disabled={authLoading} onClick={() => void resendOTP()}>{trUi("auth.noCode") + ' '}<strong>{trUi("common.resend")}</strong>
              </button>
              <button type="button" disabled={authLoading} onClick={resetRegistration}>{trUi("auth.changeEmail")}</button>
            </div>
            <p className="auth-otp-safety"><ShieldCheck size={14} />{trUi("auth.otpSafety")}</p>
          </form>
        ) : (
          <form className={`auth-card auth-login-card auth-login-card--${authMode}`} onSubmit={submitAuth}>
            <div className="auth-form-intro">
              <h2>{authMode === 'login' ? trUi("auth.welcome") : trUi("auth.createSocco")}</h2>
              <p>{authMode === 'login' ? trUi("auth.discoverCommunity") : trUi("auth.connectEmail")}</p>
            </div>
            <div className={`auth-tabs auth-tabs--${authMode}`} role="group" aria-label={trUi("auth.loginRegister")}>
              <button type="button" className={authMode === 'login' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('login')}>{trUi("auth.signIn")}</button>
              <button type="button" className={authMode === 'register' ? 'active' : ''} disabled={authLoading} onClick={() => switchMode('register')}>{trUi("auth.createAccount")}</button>
            </div>
            <label className="auth-field" htmlFor="auth-email">Email
              <input id="auth-email" type="email" value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@example.com"
                autoComplete="email" maxLength={254} required />
            </label>

            {usingPassword ? (
              <>
                <div className="auth-field">
                  <label htmlFor="auth-password">{trUi("auth.password")}</label>
                  <span className="auth-password-wrap">
                    <input id="auth-password" type={showPassword ? 'text' : 'password'}
                      value={authPassword} onChange={(event) => setAuthPassword(event.target.value)}
                      autoComplete="current-password" placeholder={trUi("auth.passwordPlaceholder")} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? trUi("auth.hidePassword") : trUi("auth.showPassword")}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />} <span>{showPassword ? trUi("common.hidden") : trUi("common.show")}</span>
                    </button>
                  </span>
                </div>
                <div className="auth-login-options">
                  <label className="auth-remember">
                    <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
                    <span>{trUi("auth.rememberEmail")}</span>
                  </label>
                  <button type="button" onClick={() => { setLoginMethod('otp'); resetRegistration() }}>{trUi("auth.forgotPassword")}</button>
                </div>
              </>
            ) : (
              <div className="auth-email-note">
                <LockKeyhole size={18} />
                <span>{authMode === 'register' ? trUi("auth.otpRegisterHint") : trUi("auth.otpLoginHint")}</span>
              </div>
            )}

            {authError && <div className="auth-alert" role="alert">{displayAuthError}</div>}
            <button className="auth-submit" type="submit" disabled={authLoading}>
              <span>{authLoading ? (usingPassword ? trUi("auth.signingIn") : trUi("auth.sending")) : authMode === 'register' ? trUi("auth.sendVerify") : usingPassword ? trUi("auth.signIn") : trUi("auth.sendOTP")}</span>
              <ArrowRight size={18} />
            </button>

            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">{trUi("auth.or")}</span>
              <span className="auth-divider-line" />
            </div>

            <div className="auth-secondary-actions">
              {authMode === 'login' && !isDesktopBuild && (
                <button type="button" className="auth-action-btn" onClick={() => { setLoginMethod(usingPassword ? 'otp' : 'password'); resetRegistration() }}>
                  <Smartphone className="auth-action-icon-desktop" size={16} />
                  {usingPassword && <Mail className="auth-action-icon-mobile" size={16} />}
                  <span>{usingPassword ? trUi("auth.otpLogin") : trUi("auth.passwordLogin")}</span>
                </button>
              )}
              <button
                type="button"
                className="auth-action-btn auth-google-btn"
                disabled
                title={trUi("auth.googleUnavailable")}
              >
                <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>{trUi("auth.google")}</span>
              </button>
            </div>

            <div className="auth-login-bottom">
              <span className="auth-login-prompt">
                {authMode === 'login' ? trUi("auth.noAccount") : trUi("auth.hasAccount")}{' '}
                <button type="button" onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? trUi("auth.registerEmail") : trUi("auth.signIn")}
                </button>
              </span>
              <button className="auth-login-bottom-mobile" type="button" onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? trUi("auth.createNewAccount") : trUi("auth.signIn")}
              </button>
            </div>
            <p className="auth-legal">{trUi("auth.legal")}</p>
          </form>
        )}
      </section>

      <footer className="auth-hero-footer">
        <span className="auth-footer-brand-desktop">© SocCo • ChatNet</span>
        <label className="auth-mobile-language" htmlFor="auth-mobile-language">{trUi("common.language")}<select id="auth-mobile-language" value={mobileLocale} onChange={(event) => {
            const nextLocale = normalizeAppLocale(event.target.value)
            setMobileLocale(nextLocale)
            try { saveAppLocalePreference(nextLocale) } catch { /* Locale preference is optional before login. */ }
          }}>
            {APP_LOCALES.map(code => <option key={code} value={code}>{APP_LOCALE_LABELS[code]}</option>)}
          </select>
        </label>
        <span className="auth-footer-brand-mobile">SocCo từ ChatNet Ecosystem</span>
      </footer>
    </main>
    </UiLocaleContext.Provider>
  )
}