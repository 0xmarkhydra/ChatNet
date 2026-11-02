import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, ChevronRight, Images, Languages, MoreHorizontal, Phone, Search, Settings2, Users, Video, X } from 'lucide-react'
import { filterLanguageOptions, type LanguageOption } from '../i18n/languages'
import './group-actions-sheet.css'

type GroupActionsSheetProps = {
  groupName: string
  memberCount: number
  autoTranslate: boolean
  targetLanguage: string
  languages: LanguageOption[]
  onClose: () => void
  onCall: (mediaType: 'audio' | 'video') => void
  onSharedContent: () => void
  onManageGroup: () => void
  onToggleAutoTranslate: () => void
  onChangeLanguage: (language: string) => void
}

export default function GroupActionsSheet({
  groupName, memberCount, autoTranslate, targetLanguage, languages,
  onClose, onCall, onSharedContent, onManageGroup,
  onToggleAutoTranslate, onChangeLanguage,
}: GroupActionsSheetProps) {
  const [screen, setScreen] = useState<'actions' | 'language'>('actions')
  const [query, setQuery] = useState('')
  const sheetRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const chosen = languages.find((option) => option.value === targetLanguage)
  const filtered = useMemo(() => filterLanguageOptions(languages, query), [languages, query])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheetRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)',
      )).filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (screen === 'language') backButtonRef.current?.focus({ preventScroll: true })
  }, [screen])

  const run = (action: () => void) => {
    onClose()
    action()
  }

  return createPortal(
    <div className="soco-group-actions-overlay">
      <button
        type="button"
        tabIndex={-1}
        className="soco-group-actions-scrim"
        onClick={onClose}
        aria-label="Đóng tùy chọn nhóm"
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={screen === 'language' ? 'Chọn ngôn ngữ dịch' : 'Tùy chọn cuộc trò chuyện nhóm'}
        className="soco-group-actions-sheet"
        tabIndex={-1}
      >
        <div className="soco-group-actions-grabber" aria-hidden="true" />
        <header className="soco-group-actions-heading">
          {screen === 'language' ? (
            <button ref={backButtonRef} type="button" className="soco-group-actions-back"
              aria-label="Quay lại tùy chọn nhóm" onClick={() => setScreen('actions')}>
              <ArrowLeft size={20} />
            </button>
          ) : <span className="soco-group-actions-heading-icon"><MoreHorizontal size={20} /></span>}
          <div className="soco-group-actions-heading-text">
            <strong>{screen === 'language' ? 'Ngôn ngữ dịch' : 'Tùy chọn nhóm'}</strong>
            <small>{screen === 'language' ? 'Chọn ngôn ngữ để dịch tin nhắn' : groupName + ' · ' + memberCount + ' thành viên'}</small>
          </div>
          <button type="button" className="soco-group-actions-close" onClick={onClose} aria-label="Đóng tùy chọn nhóm">
            <X size={20} />
          </button>
        </header>

        {screen === 'actions' ? (
          <div className="soco-group-actions-scroll">
            <div className="soco-group-actions-section-label">GỌI ĐIỆN</div>
            <div className="soco-group-actions-card soco-group-call-grid">
              <button type="button" onClick={() => run(() => onCall('audio'))}>
                <span className="soco-group-actions-icon"><Phone size={21} /></span>
                <strong>Gọi thoại</strong>
              </button>
              <button type="button" onClick={() => run(() => onCall('video'))}>
                <span className="soco-group-actions-icon"><Video size={21} /></span>
                <strong>Gọi video</strong>
              </button>
            </div>
            <div className="soco-group-actions-section-label">CUỘC TRÒ CHUYỆN</div>
            <div className="soco-group-actions-card">
              <button type="button" className="soco-group-actions-row" onClick={() => run(onSharedContent)}>
                <span className="soco-group-actions-icon"><Images size={20} /></span>
                <span className="soco-group-actions-row-copy"><strong>Ảnh, tệp & liên kết</strong><small>Nội dung đã chia sẻ</small></span>
                <ChevronRight size={19} className="soco-group-actions-chevron" />
              </button>
              <button type="button" className="soco-group-actions-row" onClick={() => run(onManageGroup)}>
                <span className="soco-group-actions-icon"><Users size={20} /></span>
                <span className="soco-group-actions-row-copy"><strong>Thành viên & quản lý nhóm</strong><small>Mời bạn, đổi tên và phân quyền</small></span>
                <ChevronRight size={19} className="soco-group-actions-chevron" />
              </button>
            </div>
            <div className="soco-group-actions-section-label">DỊCH THUẬT & AI</div>
            <div className="soco-group-actions-card">
              <button type="button" className="soco-group-actions-row" role="switch"
                aria-checked={autoTranslate} onClick={onToggleAutoTranslate}>
                <span className="soco-group-actions-icon"><Settings2 size={20} /></span>
                <span className="soco-group-actions-row-copy"><strong>Dịch tự động</strong><small>{autoTranslate ? 'Đang bật' : 'Đang tắt'}</small></span>
                <span className={autoTranslate ? 'soco-group-actions-switch on' : 'soco-group-actions-switch'} aria-hidden="true"><i /></span>
              </button>
              <button type="button" className="soco-group-actions-row" onClick={() => setScreen('language')}>
                <span className="soco-group-actions-icon"><Languages size={20} /></span>
                <span className="soco-group-actions-row-copy"><strong>Ngôn ngữ dịch</strong><small>{chosen?.flag} {chosen?.localizedLanguage || targetLanguage.toUpperCase()}</small></span>
                <ChevronRight size={19} className="soco-group-actions-chevron" />
              </button>
            </div>
          </div>
        ) : (
          <div className="soco-group-actions-language">
            <label className="soco-group-actions-search">
              <Search size={19} aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm ngôn ngữ..." autoComplete="off" />
            </label>
            <p className="soco-group-actions-count">{filtered.length} ngôn ngữ</p>
            <div className="soco-group-actions-languages" aria-label="Danh sách ngôn ngữ dịch">
              {filtered.map((language) => (
                <button type="button" key={language.value}
                  className={language.value === targetLanguage ? 'soco-group-actions-language-row selected' : 'soco-group-actions-language-row'}
                  onClick={() => run(() => onChangeLanguage(language.value))}>
                  <span className="soco-group-actions-language-flag">{language.flag}</span>
                  <span><strong>{language.localizedLanguage}</strong><small>{language.nativeLanguage}</small></span>
                  <em>{language.code}</em>
                  {language.value === targetLanguage && <Check size={18} aria-label="Đã chọn" />}
                </button>
              ))}
              {!filtered.length && <p className="soco-group-actions-empty">Không tìm thấy ngôn ngữ.</p>}
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}
