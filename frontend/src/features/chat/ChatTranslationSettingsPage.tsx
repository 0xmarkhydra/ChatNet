import { useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Info, Languages, ShieldCheck, X } from 'lucide-react'
import type { Conversation } from './types'
import type { LanguageOption } from '../i18n/languages'
import type { ChatTranslationDisplay, ChatTranslationSettings } from './conversationTranslationSettings'
import UserAvatar from '../../shared/ui/UserAvatar'

type Props = {
  conversation: Conversation
  initial: ChatTranslationSettings
  languages: LanguageOption[]
  onCancel: () => void
  onSave: (value: ChatTranslationSettings) => void
}

const DISPLAY_OPTIONS: Array<{ value: ChatTranslationDisplay, label: string }> = [
  { value: 'adaptive', label: 'Chỉ bản dịch khi cần' },
  { value: 'bilingual', label: 'Hiển thị bản gốc và bản dịch' },
  { value: 'translated', label: 'Ưu tiên bản dịch' },
]

export default function ChatTranslationSettingsPage({
  conversation, initial, languages, onCancel, onSave,
}: Props) {
  const [draft, setDraft] = useState<ChatTranslationSettings>(initial)
  const update = <K extends keyof ChatTranslationSettings>(key: K, value: ChatTranslationSettings[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }))
  const languageName = (code: string) => {
    const item = languages.find(option => option.value === code)
    if (code === 'en') return 'English (US)'
    return item?.localizedLanguage || code.toUpperCase()
  }
  const sampleOriginal = draft.sourceLanguage === 'vi' ? 'Nghe tuyệt đấy!' : 'That sounds wonderful!'
  const sampleTranslated = draft.targetLanguage === 'vi' ? 'Nghe tuyệt đấy!' : 'That sounds wonderful!'

  const languageField = (id: 'targetLanguage' | 'sourceLanguage', title: string) => (
    <label className="chat-translation-setting-field" htmlFor={id}>
      <span>{title}</span>
      <span className="chat-translation-select">
        <Languages size={19} aria-hidden="true" />
        <select id={id} value={draft[id]}
          onChange={event => update(id, event.target.value)}
          aria-label={title}>
          {languages.map(language => (
            <option value={language.value} key={language.value}>
              {language.value === 'en' ? 'English (US)' : language.localizedLanguage}
            </option>
          ))}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </span>
    </label>
  )

  return (
    <div className="chat-translation-settings-page" aria-label="Ngôn ngữ và dịch AI">
      <section className="chat-translation-settings-form" aria-labelledby="translation-page-heading">
        <div className="chat-translation-settings-heading">
          <Languages size={23} aria-hidden="true" />
          <div>
            <h1 id="translation-page-heading">Dịch tin nhắn tự động</h1>
            <p>Giúp bạn trò chuyện với người dùng khác ngôn ngữ.</p>
          </div>
        </div>
        <label className="chat-translation-setting-toggle">
          <span>
            <strong>Bật dịch cho cuộc trò chuyện này</strong>
            <small>Dịch khi có tin nhắn khác ngôn ngữ.</small>
          </span>
          <input type="checkbox" checked={draft.enabled}
            onChange={event => update('enabled', event.target.checked)}
            aria-label="Bật dịch cho cuộc trò chuyện này" />
          <span className="chat-translation-setting-switch" aria-hidden="true"><span /></span>
        </label>
        {languageField('targetLanguage', 'Ngôn ngữ của bạn')}
        {languageField('sourceLanguage', 'Ngôn ngữ người kia')}
        <label className="chat-translation-setting-field" htmlFor="translationDisplayMode">
          <span>Chế độ hiển thị</span>
          <span className="chat-translation-select">
            <Languages size={19} aria-hidden="true" />
            <select id="translationDisplayMode" value={draft.display}
              onChange={event => update('display', event.target.value as ChatTranslationDisplay)}
              aria-label="Chế độ hiển thị">
              {DISPLAY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={17} aria-hidden="true" />
          </span>
        </label>
        <p className="chat-translation-settings-note">
          <ShieldCheck size={17} aria-hidden="true" />
          Bạn có thể tắt dịch bất cứ lúc nào. AI tự nhận biết ngôn ngữ nguồn; cài đặt này lưu trên thiết bị.
        </p>
        <div className="chat-translation-settings-actions">
          <button type="button" className="chat-translation-cancel" onClick={onCancel}>
            <X size={17} aria-hidden="true" /> Hủy
          </button>
          <button type="button" className="chat-translation-save" onClick={() => onSave(draft)}>
            <Check size={18} aria-hidden="true" /> Lưu thay đổi
          </button>
        </div>
      </section>
      <aside className="chat-translation-settings-preview" aria-label="Xem trước bản dịch">
        <h2>Xem trước</h2>
        <div className="chat-translation-preview-person">
          <UserAvatar name={conversation.name} username={conversation.otherUsername}
            group={conversation.type === 'group'} />
          <strong>{conversation.name}</strong>
        </div>
        <div className="chat-translation-preview-source">
          <p>{sampleOriginal}</p>
          <small>{languageName(draft.sourceLanguage)} · Tin gốc</small>
        </div>
        {draft.enabled ? (
          <div className="chat-translation-preview-result">
            <span><Languages size={17} aria-hidden="true" /> BẢN DỊCH · {languageName(draft.targetLanguage).toUpperCase()}</span>
            <strong>{sampleTranslated}</strong>
            <small>{draft.display === 'translated' ? 'Ưu tiên bản dịch' :
              draft.display === 'bilingual' ? 'Hiển thị cùng tin gốc' : 'Hiển thị khi cần thiết'}</small>
          </div>
        ) : (
          <div className="chat-translation-preview-disabled">Dịch tự động đang tắt đối với cuộc trò chuyện này.</div>
        )}
        <div className="chat-translation-preview-tip">
          <h3><Info size={18} aria-hidden="true" /> Lưu ý về bản dịch</h3>
          <p>Đây là ví dụ minh họa. Kết quả dịch thực tế có thể khác tùy ngôn ngữ và ngữ cảnh.</p>
          <p>Có thể xem lại tin gốc khi cần.</p>
        </div>
        <button className="chat-translation-preview-back" type="button" onClick={onCancel}>
          <ArrowLeft size={16} aria-hidden="true" /> Quay lại hội thoại
        </button>
      </aside>
    </div>
  )
}
