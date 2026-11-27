import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { searchStickers, stickerFile, type Sticker } from '../utils/stickerCatalog'

type Props = { onSelect: (file: File) => void; disabled: boolean; userId?: number }
type Library = { recent: string[]; favorites: string[] }
const emptyLibrary: Library = { recent: [], favorites: [] }

function readLibrary(key: string): Library {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Partial<Library>
    const ids = (items: unknown) => Array.isArray(items) ? items.filter((id): id is string => typeof id === 'string').slice(0, 100) : []
    return { recent: ids(value.recent), favorites: ids(value.favorites) }
  } catch { return emptyLibrary }
}

export default function ChatStickerPicker({ onSelect, disabled, userId }: Props) {
  const trUi = useUiTranslation()

  const storageKey = 'soco.stickers.' + (userId ?? 'guest')
  const [library, setLibrary] = useState(() => readLibrary(storageKey))
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'recent' | 'favorites'>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const matched = searchStickers(query)
  const items = tab === 'all' ? matched : library[tab].flatMap(id => matched.filter(item => item.id === id))

  function save(next: Library) {
    setLibrary(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Storage unavailable. */ }
  }

  async function select(item: Sticker) {
    setBusy(true)
    setError('')
    try {
      const file = await stickerFile(item)
      if (!active.current) return
      save({ ...library, recent: [item.id, ...library.recent.filter(id => id !== item.id)].slice(0, 30) })
      onSelect(file)
    } catch { if (active.current) setError('Không thể tạo sticker. Vui lòng thử lại.') }
    finally { if (active.current) setBusy(false) }
  }

  return <div className="flex flex-col gap-ui-2 p-ui-2">
    <div className="flex gap-ui-1" role="group" aria-label="Kho sticker">
      {([['all', 'Tất cả'], ['recent', 'Gần đây'], ['favorites', 'Yêu thích']] as const).map(([id, label]) =>
        <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}
          className="min-h-control-touch flex-1 rounded-ui-md border-0 bg-transparent text-ui-label text-foreground aria-pressed:bg-accent aria-pressed:text-primary">{label}</button>)}
    </div>
    <input type="search" aria-label={trUi("chat.stickerSearch")} placeholder={trUi("chat.stickerPlaceholder")} value={query}
      onChange={event => setQuery(event.target.value)}
      className="min-h-control-touch w-full rounded-ui-md border border-border bg-card px-ui-3 text-foreground" />
    <div className="grid max-h-64 grid-cols-4 gap-ui-2 overflow-y-auto overscroll-contain">
      {items.map(item => <div key={item.id} className="relative">
        <button type="button" disabled={busy || disabled} aria-label={item.label} title={item.label}
          className="flex aspect-square w-full min-h-control-touch cursor-pointer items-center justify-center rounded-ui-md border-0 bg-transparent text-4xl hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          onClick={() => void select(item)}>{item.emoji}</button>
        <button type="button" disabled={busy} aria-label={'Yêu thích ' + item.label} aria-pressed={library.favorites.includes(item.id)}
          className="absolute right-0 top-0 flex size-7 items-center justify-center rounded-ui-sm border-0 bg-card text-muted-foreground aria-pressed:text-primary"
          onClick={() => save({ ...library, favorites: library.favorites.includes(item.id) ? library.favorites.filter(id => id !== item.id) : [...library.favorites, item.id].slice(-100) })}>
          <Heart size={14} fill={library.favorites.includes(item.id) ? 'currentColor' : 'none'} />
        </button>
      </div>)}
    </div>
    {!items.length && <p role="status" className="text-ui-label text-muted-foreground">{trUi("chat.noSticker")}</p>}
    {error && <p role="alert" className="text-ui-label text-danger">{error}</p>}
  </div>
}
