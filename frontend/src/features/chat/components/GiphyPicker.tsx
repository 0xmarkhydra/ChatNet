import { useEffect, useState } from 'react'
import { giphyConfigured, searchGiphy, type GiphyItem, type GiphyKind } from '../api/giphy'

type Props = { disabled: boolean; onSelect: (url: string) => void }

export default function GiphyPicker({ disabled, onSelect }: Props) {
  const [kind, setKind] = useState<GiphyKind>('stickers')
  const [query, setQuery] = useState('')
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; items: GiphyItem[]; error?: string }>()
  const requestKey = JSON.stringify([kind, query, retry])
  const current = result?.key === requestKey ? result : undefined
  useEffect(() => {
    if (!giphyConfigured) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchGiphy(kind, query, controller.signal).then(items => {
        if (!controller.signal.aborted) setResult({ key: requestKey, items })
      }, (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, items: [], error: error instanceof Error ? error.message : 'Không thể tải GIPHY.' })
      })
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [kind, query, requestKey])
  return <div className="flex flex-col gap-ui-2 p-ui-2">
    <div role="group" aria-label="Loại nội dung GIPHY" className="flex gap-ui-2">
      {(['stickers', 'gifs'] as const).map(value => <button key={value} type="button" aria-pressed={kind === value}
        onClick={() => setKind(value)} className="flex-1 min-h-control-touch rounded-ui-md border-0 bg-transparent text-foreground aria-pressed:bg-accent">
        {value === 'stickers' ? 'Sticker động' : 'GIF'}
      </button>)}
    </div>
    <input type="search" aria-label="Tìm GIPHY" placeholder="Tìm GIF hoặc sticker..." value={query}
      onChange={event => setQuery(event.target.value)} className="min-h-control-touch w-full rounded-ui-md border border-border bg-card px-ui-3 text-foreground" />
    {!giphyConfigured ? <p role="status">Chưa cấu hình API key GIPHY.</p> : !current ? <p role="status">Đang tải...</p> : current.error ?
      <div role="alert">{current.error} <button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> :
      current.items.length ? <div className="grid max-h-64 grid-cols-3 gap-ui-2 overflow-y-auto overscroll-contain">
        {current.items.map(item => <button key={item.id} type="button" disabled={disabled} aria-label={item.title}
          onClick={() => onSelect(item.url)} className="aspect-square cursor-pointer overflow-hidden rounded-ui-md border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-ring">
          <img src={item.preview} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
        </button>)}
      </div> : <p role="status">Không tìm thấy kết quả.</p>}
    <p className="text-ui-caption text-muted-foreground">Powered by GIPHY</p>
  </div>
}
