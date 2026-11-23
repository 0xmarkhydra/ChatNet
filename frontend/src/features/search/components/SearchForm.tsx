import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { SEARCH_TYPES, type SearchType } from '../lib/searchFilters'
import { iconButton } from './ui'

export type SearchFormProps = {
  initialQuery: string
  placeholder: string
  /** Full-width form for the no-keyword home: scope select and submit button next to the field. */
  large?: boolean
  autoFocus?: boolean
  className?: string
  onSubmit: (query: string, scope: SearchType) => void
}

const pill = 'flex min-w-0 items-center gap-ui-2 rounded-full bg-muted text-muted-foreground focus-within:bg-card focus-within:ring-2 focus-within:ring-ring'

/** Owns only the draft text; the committed query lives in the URL. Remount with a key to reset. */
export default function SearchForm({ initialQuery, placeholder, large = false, autoFocus = false, className, onSubmit }: SearchFormProps) {
  const [draft, setDraft] = useState(initialQuery)
  const [scope, setScope] = useState<SearchType>('all')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) onSubmit(draft.trim().slice(0, 120), scope)
  }

  return (
    <form role="search" onSubmit={submit} className={cn('m-0 flex min-w-0 items-center', large && 'gap-ui-3 max-sm:gap-ui-2', className)}>
      <div className={cn(pill, large ? 'h-12 min-w-60 flex-1 px-ui-4 max-sm:min-w-0' : 'min-h-11 w-full pr-ui-2 pl-ui-3')}>
        <Search size={large ? 20 : 18} aria-hidden="true" className="shrink-0" />
        <input type="search" aria-label="Tìm kiếm trên SocCo" value={draft} maxLength={120} placeholder={placeholder}
          autoFocus={autoFocus} enterKeyHint="search" onChange={event => setDraft(event.target.value)}
          className={cn('h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden',
            large ? 'text-[length:var(--soco-type-subtitle)]' : 'text-[length:var(--soco-type-body)] max-lg:text-[length:var(--soco-type-subtitle)]')} />
        {draft && (
          <button type="button" className={cn(iconButton, 'size-8 bg-border text-foreground max-lg:size-8')} aria-label="Xóa từ khóa" onClick={() => setDraft('')}><X size={16} /></button>
        )}
      </div>
      {large && (
        <>
          <select aria-label="Phạm vi tìm kiếm" value={scope} onChange={event => setScope(event.target.value as SearchType)}
            className="h-12 cursor-pointer rounded-full border-0 bg-muted px-ui-4 text-[length:var(--soco-type-body)] font-semibold text-foreground max-sm:hidden">
            {SEARCH_TYPES.map(item => <option key={item.key} value={item.key}>{item.key === 'all' ? 'Mọi thứ' : item.label}</option>)}
          </select>
          <Button type="submit" className="h-12 rounded-full px-ui-6 max-sm:px-ui-4" disabled={!draft.trim()}>Tìm kiếm</Button>
        </>
      )}
    </form>
  )
}
