import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, BookUser, CalendarDays, Check, Clock3, Languages, MessageCircle,
  PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing,
  RefreshCw, Search, Settings2, ShieldCheck, Users, X,
} from 'lucide-react'
import type { Conversation } from '../chat/types'
import UserAvatar from '../../shared/ui/UserAvatar'
import { CallHeaderActions } from './CallManager'
import { getCallHistory, type CallHistoryEntry, type CallRequest } from './calls'
import { formatDuration, latestCallDuration } from './call-history'
import './call-center.css'

type View = 'history' | 'people' | 'directory' | 'settings'
type Filter = 'all' | 'missed' | 'outgoing' | 'group'
type Props = {
  request: CallRequest
  userId: number
  token: string
  conversations: Conversation[]
  targetLanguage: string
  directoryContent: ReactNode
  directoryQuery: string
  onDirectoryQueryChange: (value: string) => void
  onDirectoryOpen: () => void
  onNavigate: (tab: 'feed' | 'chat' | 'contacts') => void
  onOpenChat: (id: number) => void
  embedded?: boolean
}

const ENABLE_KEY = 'chatnet.call.translation.autostart.v1'
const LANGUAGE_KEY = 'chatnet.call.target-language.v1'
const CAPTION_KEY = 'chatnet.call.subtitle-mode.v1'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function outcome(entry: CallHistoryEntry, userId: number) {
  if (entry.createdBy !== userId && !entry.joined && !entry.declined) return 'Gọi nhỡ'
  if (entry.declined) return 'Đã từ chối'
  if (entry.joined && entry.startedAt) return entry.createdBy === userId ? 'Đã gọi' : 'Đã nhận'
  return 'Không kết nối'
}

export default function CallCenter({ request, userId, token, conversations, targetLanguage, directoryContent, directoryQuery, onDirectoryQueryChange, onDirectoryOpen, onNavigate, onOpenChat, embedded = false }: Props) {
  const requestRef = useRef(request)
  requestRef.current = request
  const [view, setView] = useState<View>('history')
  const previousViewRef = useRef<Exclude<View, 'settings'>>('history')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<CallHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshId, setRefreshId] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoTranslation, setAutoTranslation] = useState(() => localStorage.getItem(ENABLE_KEY) === 'true')
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) || targetLanguage.split('-')[0] || 'vi')
  const [captionMode, setCaptionMode] = useState(() => localStorage.getItem(CAPTION_KEY) || 'both')
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [savingMessage, setSavingMessage] = useState('')

  // On mobile the app can return from a call or wake from a background tab.
  // Refresh completed calls when the view becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRefreshId((value) => value + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getCallHistory(requestRef.current).then((items) => {
      if (!cancelled) {
        if (!Array.isArray(items)) throw new Error('Dữ liệu lịch sử cuộc gọi không hợp lệ.')
        setEntries(items)
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử cuộc gọi.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, refreshId])

  useEffect(() => {
    let cancelled = false
    requestRef.current('/api/calls/translation/languages').then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { languages?: string[] }
      if (!cancelled && Array.isArray(body.languages)) setAvailableLanguages(body.languages)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [token])

  const conversationMap = useMemo(() => new Map(conversations.map((item) => [item.id, item])), [conversations])
  const missed = (item: CallHistoryEntry) => outcome(item, userId) === 'Gọi nhỡ'
  const month = new Date().getMonth()
  const year = new Date().getFullYear()
  const monthCount = entries.filter((item) => {
    const date = new Date(item.createdAt)
    return date.getMonth() === month && date.getFullYear() === year
  }).length
  const missedCount = entries.filter(missed).length
  const filtered = entries.filter((entry) => {
    if (filter === 'missed' && !missed(entry)) return false
    if (filter === 'outgoing' && entry.createdBy !== userId) return false
    if (filter === 'group' && !entry.isGroup) return false
    const name = conversationMap.get(entry.conversationId)?.name || String(entry.conversationId)
    return name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))
  })
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null
  const contacts = conversations.filter((conversation) =>
    conversation.name.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))
  const languageLabels: Record<string, string> = {
    vi: 'Tiếng Việt', en: 'English (United States)', ja: '日本語 (Nhật)', ko: '한국어 (Hàn)',
    'zh-Hans': '中文 (Giản thể)', fr: 'Français (Pháp)', de: 'Deutsch (Đức)',
    es: 'Español (Tây Ban Nha)', pt: 'Português', hi: 'हिन्दी', th: 'ภาษาไทย',
  }
  const languages = Array.from(new Set([language, ...availableLanguages]))
  const saveSettings = () => {
    try {
      localStorage.setItem(ENABLE_KEY, String(autoTranslation))
      localStorage.setItem(LANGUAGE_KEY, language)
      localStorage.setItem(CAPTION_KEY, captionMode)
      setSavingMessage('Đã lưu cài đặt trên thiết bị này. Áp dụng từ cuộc gọi tiếp theo.')
    } catch {
      setSavingMessage('Không thể lưu trên thiết bị. Hãy kiểm tra quyền lưu trữ của trình duyệt.')
    }
  }
  const showView = (next: View) => {
    if (next === 'directory' && view !== 'settings' && view !== 'directory') onDirectoryOpen()
    if (view === 'directory' && next !== 'directory' && next !== 'settings') onDirectoryQueryChange('')
    if (next === 'settings' && view !== 'settings') previousViewRef.current = view
    if (view === 'settings' && next !== 'settings') {
      setAutoTranslation(localStorage.getItem(ENABLE_KEY) === 'true')
      setLanguage(localStorage.getItem(LANGUAGE_KEY) || targetLanguage.split('-')[0] || 'vi')
      setCaptionMode(localStorage.getItem(CAPTION_KEY) || 'both')
    }
    setView(next)
    setQuery('')
    setSavingMessage('')
  }

  return (
    <div className={'call-center' + (embedded ? ' is-embedded' : '')}>
      <aside className="call-center-sidebar" aria-label="Điều hướng SocCo">
        <div className="call-center-brand">
          <span className="call-center-logo">S</span><span><strong>SocCo</strong><small>ChatNet · Kết nối cộng đồng</small></span>
        </div>
        <nav className="call-center-navigation" aria-label="Điều hướng">
          <button type="button" onClick={() => onNavigate('feed')}><span className="call-nav-symbol"><CalendarDays size={19} /></span>Bảng tin</button>
          <button type="button" onClick={() => onNavigate('chat')}><span className="call-nav-symbol"><MessageCircle size={19} /></span>Tin nhắn</button>
          <button type="button" onClick={() => onNavigate('contacts')}><span className="call-nav-symbol"><Users size={19} /></span>Bạn bè</button>
          <button type="button" className={view === 'people' ? 'active' : ''} onClick={() => showView('people')}><span className="call-nav-symbol"><PhoneCall size={19} /></span>Bắt đầu cuộc gọi</button>
          <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => showView('history')}><span className="call-nav-symbol"><Clock3 size={19} /></span>Lịch sử cuộc gọi</button>
          <button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => showView('settings')}><span className="call-nav-symbol"><Languages size={19} /></span>Dịch AI</button>
        </nav>
        <div className="call-center-sidebar-foot"><ShieldCheck size={18} /> Cuộc gọi được mã hóa E2EE</div>
      </aside>

      <div className="call-center-workspace">
        <header className="call-center-header">
          <div className="call-center-heading">
            <h1>{view === 'history' ? 'Lịch sử cuộc gọi' : view === 'people' ? 'Cuộc gọi' : view === 'directory' ? 'Danh bạ' : 'Cài đặt dịch AI'}</h1>
            <p>{view === 'history' ? 'Cuộc gọi nhỡ, đã nhận và đã thực hiện' : view === 'people' ? 'Kết nối bằng thoại hoặc video với bạn bè và nhóm' : view === 'directory' ? 'Tìm kiếm, quản lý và kết nối bạn bè' : 'Điều chỉnh phụ đề trong cuộc gọi'}</p>
          </div>
          <div className="call-center-header-actions">
            <div className="call-center-tabs" role="group" aria-label="Chọn màn cuộc gọi">
              <button type="button" className={view === 'history' ? 'active' : ''} aria-pressed={view === 'history'} onClick={() => showView('history')}><Clock3 size={15} /> Lịch sử</button>
              <button type="button" className={view === 'people' ? 'active' : ''} aria-pressed={view === 'people'} onClick={() => showView('people')}><PhoneCall size={15} /> Liên hệ</button>
              <button type="button" className={view === 'directory' ? 'active' : ''} aria-pressed={view === 'directory'} onClick={() => showView('directory')}><BookUser size={15} /> Danh bạ</button>
            </div>
            {view !== 'settings' && <label className={'call-center-search' + (view === 'directory' ? ' call-center-directory-search' : '')}><Search size={18} /><input value={view === 'directory' ? directoryQuery : query} onChange={(event) => view === 'directory' ? onDirectoryQueryChange(event.target.value) : setQuery(event.target.value)} placeholder={view === 'directory' ? 'Tìm kiếm trong danh bạ...' : 'Tìm kiếm trên SocCo...'} aria-label={view === 'directory' ? 'Tìm trong danh bạ' : 'Tìm cuộc trò chuyện'} />{(view === 'directory' ? directoryQuery : query) && <button type="button" onClick={() => view === 'directory' ? onDirectoryQueryChange('') : setQuery('')} aria-label="Xóa tìm kiếm"><X size={14} /></button>}</label>}
            <button type="button" className="call-center-settings-trigger" onClick={() => showView(view === 'settings' ? previousViewRef.current : 'settings')} title={view === 'settings' ? 'Quay lại lịch sử' : 'Cài đặt dịch AI'} aria-label={view === 'settings' ? 'Quay lại lịch sử' : 'Cài đặt dịch AI'}>{view === 'settings' ? <ArrowLeft size={20} /> : <Settings2 size={20} />}</button>
          </div>
        </header>

        {view === 'directory' && <div className="call-center-content call-center-directory">{directoryContent}</div>}

        {view === 'history' && (
          <div className="call-center-content">
            <section className="call-center-stats" aria-label="Thống kê lịch sử đã tải">
              <div><strong>{monthCount}</strong><span>Cuộc gọi tháng này</span></div>
              <div><strong className="danger">{missedCount}</strong><span>Cuộc gọi nhỡ</span></div>
              <div><strong className="teal">{latestCallDuration(entries)}</strong><span>Thời lượng cuộc gọi gần nhất</span></div>
            </section>
            <div className="call-center-filters" role="group" aria-label="Lọc lịch sử">
              {([['all', 'Tất cả'], ['missed', 'Gọi nhỡ'], ['outgoing', 'Đã gọi'], ['group', 'Gọi nhóm']] as const).map(([id, label]) =>
                <button key={id} type="button" className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
              <button type="button" className="call-center-refresh" onClick={() => setRefreshId((n) => n + 1)} disabled={loading} aria-label="Tải lại lịch sử" title="Tải lại lịch sử"><RefreshCw size={17} /></button>
            </div>
            <div className="call-history-layout">
              <section className="call-history-list call-center-card" aria-label="Danh sách lịch sử">
                <h2>Cuộc gọi gần đây</h2>
                {loading && <div className="call-center-state" role="status">Đang tải lịch sử cuộc gọi…</div>}
                {!loading && error && <div className="call-center-state" role="alert"><strong>Không thể tải lịch sử</strong><p>{error}</p><button type="button" onClick={() => setRefreshId((n) => n + 1)}>Thử lại</button></div>}
                {!loading && !error && filtered.length === 0 && <div className="call-center-state"><PhoneMissed size={31} /><strong>{query || filter !== 'all' ? 'Không có kết quả phù hợp' : 'Chưa có cuộc gọi nào'}</strong><p>Lịch sử thật từ máy chủ sẽ xuất hiện tại đây khi bạn thực hiện cuộc gọi.</p><button type="button" onClick={() => showView('people')}>Bắt đầu cuộc gọi</button></div>}
                {!loading && !error && filtered.map((entry) => {
                  const conversation = conversationMap.get(entry.conversationId)
                  const isMissed = missed(entry)
                  const duration = formatDuration(entry)
                  return (
                    <button type="button" key={entry.id} className={'call-history-item' + (selected?.id === entry.id ? ' selected' : '')} onClick={() => setSelectedId(entry.id)} aria-pressed={selected?.id === entry.id}>
                      <UserAvatar name={conversation?.name || 'Cuộc trò chuyện'} username={conversation?.otherUsername} group={entry.isGroup} className="call-history-avatar" />
                      <span className="call-history-main"><strong>{conversation?.name || 'Cuộc trò chuyện #' + entry.conversationId}</strong><small className={isMissed ? 'missed' : ''}>{entry.isGroup ? 'Nhóm · ' : ''}{entry.mediaType === 'video' ? 'Video' : 'Gọi thoại'} · {outcome(entry, userId)}{' · ' + duration}</small></span>
                      <span className="call-history-time">{formatDate(entry.createdAt)}</span>
                      {isMissed ? <PhoneMissed size={19} className="call-history-icon" /> : entry.createdBy === userId ? <PhoneOutgoing size={19} className="call-history-icon" /> : <PhoneIncoming size={19} className="call-history-icon" />}
                    </button>
                  )
                })}
                <small className="call-center-limit">Hiển thị tối đa 100 cuộc gọi gần nhất mà bạn có quyền truy cập.</small>
              </section>
              <aside className="call-history-details call-center-card">
                <h2>Chi tiết cuộc gọi</h2>
                {selected && !error ? (() => {
                  const conversation = conversationMap.get(selected.conversationId)
                  return <div className="call-detail-body">
                    <UserAvatar name={conversation?.name || 'Cuộc trò chuyện'} username={conversation?.otherUsername} group={selected.isGroup} className="call-detail-avatar" />
                    <h3>{conversation?.name || 'Cuộc trò chuyện #' + selected.conversationId}</h3>
                    <p className={missed(selected) ? 'missed' : 'success'}>{selected.mediaType === 'video' ? 'Video' : 'Gọi thoại'} · {outcome(selected, userId)}</p>
                    <dl>
                      <div><dt>Thời gian bắt đầu</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                      <div><dt>Thời lượng</dt><dd>{formatDuration(selected)}</dd></div>
                      <div><dt>Người tham gia</dt><dd>{selected.participantCount} người đã kết nối</dd></div>
                      <div><dt>Loại cuộc gọi</dt><dd>{selected.isGroup ? 'Cuộc gọi nhóm' : 'Cá nhân'}</dd></div>
                    </dl>
                    {conversation ? <div className="call-detail-actions"><CallHeaderActions conversationId={selected.conversationId} /><button type="button" onClick={() => onOpenChat(selected.conversationId)}>Mở tin nhắn</button></div> : <p className="call-detail-unavailable">Tải cuộc trò chuyện tương ứng trong Tin nhắn để gọi lại.</p>}
                  </div>
                })() : <div className="call-center-state"><Clock3 size={30} /><p>Chọn một cuộc gọi để xem chi tiết.</p></div>}
              </aside>
            </div>
          </div>
        )}

        {view === 'people' && <div className="call-center-content">
          <div className="call-center-section-intro"><div><h2>Gọi cho bạn bè và nhóm</h2><p>Chọn cuộc hội thoại để bắt đầu một cuộc gọi được mã hóa.</p></div><button type="button" onClick={() => showView('history')}><Clock3 size={17} /> Xem lịch sử</button></div>
          <section className="call-people-list call-center-card" aria-label="Danh sách có thể gọi">
            {contacts.map((conversation) => <div className="call-person-row" key={conversation.id}>
              <button type="button" className="call-person-identity" onClick={() => onOpenChat(conversation.id)}
                title={'Mở cuộc trò chuyện với ' + conversation.name} aria-label={'Mở cuộc trò chuyện với ' + conversation.name}>
                <UserAvatar name={conversation.name} username={conversation.otherUsername} group={conversation.type === 'group'} className="call-history-avatar" online={conversation.type === 'direct' && conversation.online} />
                <span className="call-person-info"><strong>{conversation.name}</strong><small>{conversation.type === 'group' ? 'Nhóm · ' + conversation.memberCount + ' thành viên' : conversation.online ? 'Đang hoạt động' : 'Cuộc trò chuyện cá nhân'}</small></span>
              </button>
              <CallHeaderActions conversationId={conversation.id} />
            </div>)}
            {contacts.length === 0 && <div className="call-center-state"><Users size={32} /><strong>Chưa có cuộc trò chuyện phù hợp</strong><p>Mở Tin nhắn để kết nối với bạn bè và tạo nhóm.</p><button type="button" onClick={() => onNavigate('chat')}>Mở tin nhắn</button></div>}
          </section>
        </div>}

        {view === 'settings' && <div className="call-center-content">
          <div className="call-settings-layout">
            <section className="call-settings-form call-center-card">
              <div className="call-center-section-intro"><div><h2><Languages size={22} /> Dịch thời gian thực</h2><p>Nghe và đọc phụ đề bằng ngôn ngữ phù hợp.</p></div></div>
              <label className="call-setting-switch"><span><strong>Tự động bật dịch AI khi tham gia cuộc gọi</strong><small>Chỉ gửi giọng nói tới AI khi từng người tham gia cho phép.</small></span><input type="checkbox" checked={autoTranslation} onChange={(event) => setAutoTranslation(event.target.checked)} /></label>
              <label className="call-setting-field"><strong>Ngôn ngữ nói</strong><select value="auto" disabled><option value="auto">Tự động nhận diện giọng nói</option></select></label>
              <label className="call-setting-field"><strong>Ngôn ngữ nhận bản dịch</strong><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((code) => <option key={code} value={code}>{languageLabels[code] || code}</option>)}</select><small>Danh sách ngôn ngữ do dịch vụ dịch cung cấp.</small></label>
              <label className="call-setting-field"><strong>Chế độ phụ đề</strong><select value={captionMode} onChange={(event) => setCaptionMode(event.target.value)}><option value="both">Gốc + bản dịch</option><option value="translated">Chỉ bản dịch</option></select></label>
              <label className="call-setting-field"><strong>Giọng đọc bản dịch</strong><select disabled value="off"><option value="off">Chưa hỗ trợ đọc thành tiếng</option></select></label>
              <div className="call-setting-actions"><button type="button" className="call-setting-cancel" onClick={() => showView('history')}><X size={17} /> Hủy</button><button type="button" className="call-setting-save" onClick={saveSettings}><Check size={17} /> Áp dụng thay đổi</button></div>
              {savingMessage && <p className="call-setting-feedback" role="status">{savingMessage}</p>}
            </section>
            <aside className="call-settings-aside">
              <section className="call-center-card"><h2>Xem trước phụ đề</h2><p>Minh họa cách hiển thị trong cuộc gọi khi bật dịch.</p><div className="call-caption-preview"><div className="call-preview-speaker"><span className="call-preview-avatar">A</span><span><strong>Người tham gia</strong><small>ĐANG NÓI</small></span></div>{captionMode === 'both' && <div className="call-preview-original">Hi! Can you hear me?</div>}<div className="call-preview-translated"><small>BẢN DỊCH · VIỆT</small>Chào! Bạn nghe thấy mình không?</div></div></section>
              <section className="call-center-card call-settings-privacy"><h2><ShieldCheck size={20} /> Minh bạch về dữ liệu</h2><p>Để dịch giọng nói, mỗi người nói phải đồng ý cho phép xử lý âm thanh trong cuộc gọi. Có thể thu hồi quyền bất kỳ lúc nào.</p><small>Độ trễ dịch có thể thay đổi tùy mạng và thiết bị.</small></section>
            </aside>
          </div>
        </div>}
      </div>
    </div>
  )
}
