import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { iconButton } from './ui'

export type SearchFormProps = {
  initialQuery: string
  placeholder: string
  large?: boolean
  autoFocus?: boolean
  className?: string
  onSubmit: (query: string) => void
}

/** Owns only the draft text; the committed query lives in the URL. Remount with a key to reset. */
export default function SearchForm({ initialQuery, placeholder, large = false, autoFocus = false, className, onSubmit }: SearchFormProps) {
  const [draft, setDraft] = useState(initialQuery)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) onSubmit(draft.trim().slice(0, 120))
  }

  return (
    <form role="search" onSubmit={submit} className={cn(
      'm-0 flex items-center gap-ui-2 rounded-full text-muted-foreground focus-within:ring-2 focus-within:ring-ring',
      large ? 'min-h-13 bg-card py-ui-1 pr-ui-1 pl-ui-4 shadow-ui-sm' : 'min-h-10 bg-muted pr-ui-2 pl-ui-3 focus-within:bg-card max-lg:min-h-11',
      className,
    )}>
      <Search size={large ? 20 : 18} aria-hidden="true" className="shrink-0" />
      <input type="search" aria-label="Tìm kiếm trên SocCo" value={draft} maxLength={120} placeholder={placeholder}
        autoFocus={autoFocus} enterKeyHint="search" onChange={event => setDraft(event.target.value)}
        className={cn('min-w-0 flex-1 border-0 bg-transparent p-0 text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden',
          large ? 'text-[length:var(--soco-type-subtitle)]' : 'text-[length:var(--soco-type-body)] max-lg:text-[length:var(--soco-type-subtitle)]')} />
      {draft && (
        <button type="button" className={iconButton} aria-label="Xóa từ khóa" onClick={() => setDraft('')}><X size={16} /></button>
      )}
      {large && <Button type="submit" size="lg" className="rounded-full" disabled={!draft.trim()}>Tìm kiếm</Button>}
    </form>
  )
}
