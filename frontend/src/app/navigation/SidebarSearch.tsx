import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/lib/utils'

const scopes = [
  { id: 'all', label: 'Tất cả' },
  { id: 'people', label: 'Người' },
  { id: 'posts', label: 'Bài viết' },
  { id: 'groups', label: 'Nhóm' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'messages', label: 'Tin nhắn' },
] as const

type Scope = typeof scopes[number]['id']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSearch: (query: string, scope: Scope) => void
}

/** Search route owns retrieval. This dialog never makes a request itself. */
export default function SidebarSearch({ open, onOpenChange, onSearch }: Props) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return
    onSearch(query.trim(), scope)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[22%] max-w-xl gap-3 p-4" aria-describedby="sidebar-search-description">
        <DialogTitle>Tìm kiếm trên SocCo</DialogTitle>
        <DialogDescription id="sidebar-search-description">Nhấn Enter để xem kết quả, Esc để đóng.</DialogDescription>
        <form onSubmit={submit} role="search" className="flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search size={19} aria-hidden="true" />
            <Input ref={inputRef} className="border-0 shadow-none focus-visible:ring-0" type="search" aria-label="Từ khóa tìm kiếm" placeholder="Tìm người, bài viết, nhóm..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div role="tablist" aria-label="Phạm vi tìm kiếm" className="flex flex-wrap gap-1">
            {scopes.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={scope === item.id}
                tabIndex={scope === item.id ? 0 : -1}
                className={cn('min-h-11 rounded-full px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring', scope === item.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
                onClick={() => setScope(item.id)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? scopes.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + scopes.length) % scopes.length
                  setScope(scopes[next].id)
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
                }}
              >{item.label}</button>
            ))}
          </div>
          <button type="submit" disabled={!query.trim()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring">Xem kết quả</button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
