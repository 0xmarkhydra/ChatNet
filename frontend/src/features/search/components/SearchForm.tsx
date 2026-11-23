import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useSuggestions, type SuggestConfig, type Suggestion } from '../hooks/useSuggestions'
import { SEARCH_TYPES, type SearchType } from '../lib/searchFilters'
import SearchSuggestions from './SearchSuggestions'
import { iconButton } from './ui'

export type SearchFormProps = {
  initialQuery: string
  placeholder: string
  /** Full-width form for the no-keyword home: scope select and submit button next to the field. */
  large?: boolean
  autoFocus?: boolean
  className?: string
  /** Typeahead: the draft, the user's past searches, and matching people and communities. */
  suggest: SuggestConfig
  onSubmit: (query: string, scope: SearchType) => void
}

const pill = 'flex min-w-0 items-center gap-ui-2 rounded-full bg-muted text-muted-foreground focus-within:bg-card focus-within:ring-2 focus-within:ring-ring'

/** Owns only the draft text; the committed query lives in the URL. Remount with a key to reset. */
export default function SearchForm({ initialQuery, placeholder, large = false, autoFocus = false, className, suggest, onSubmit }: SearchFormProps) {
  const listId = useId()
  const [draft, setDraft] = useState(initialQuery)
  const [scope, setScope] = useState<SearchType>('all')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Suggestions only appear once the user has typed something different from the committed query.
  const typing = open && draft.trim() !== '' && draft.trim() !== initialQuery
  const options = useSuggestions(suggest, draft, typing)
  const showList = typing && options.length > 0

  const edit = (value: string) => { setDraft(value); setActive(0); setOpen(true) }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setOpen(false)
    if (draft.trim()) onSubmit(draft.trim().slice(0, 120), scope)
  }
  const pick = (option: Suggestion) => {
    setOpen(false)
    if (option.kind === 'query') suggest.onQuery(option.query)
    else if (option.kind === 'person') suggest.onPerson(option.username, option.title)
    else suggest.onCommunity(option.name)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && showList) {
      event.preventDefault()
      setOpen(false)
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive(current => (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (event.key === 'Enter' && showList && active > 0) {
      event.preventDefault()
      pick(options[active])
    }
  }

  return (
    <form role="search" onSubmit={submit} className={cn('m-0 flex min-w-0 items-center', large && 'gap-ui-3 max-sm:gap-ui-2', className)}>
      <div className={cn('relative min-w-0', large ? 'min-w-60 flex-1 max-sm:min-w-0' : 'w-full')}>
        <div className={cn(pill, large ? 'h-12 px-ui-4' : 'min-h-11 w-full pr-ui-2 pl-ui-3')}>
          <Search size={large ? 20 : 18} aria-hidden="true" className="shrink-0" />
          <input type="search" role="combobox" aria-label="Tìm kiếm trên SocCo" aria-autocomplete="list" aria-expanded={showList} aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList ? listId + '-' + active : undefined} autoComplete="off"
            value={draft} maxLength={120} placeholder={placeholder} autoFocus={autoFocus} enterKeyHint="search"
            onChange={event => edit(event.target.value)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
            className={cn('h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden',
              large ? 'text-[length:var(--soco-type-subtitle)]' : 'text-[length:var(--soco-type-body)] max-lg:text-[length:var(--soco-type-subtitle)]')} />
          {draft && (
            <button type="button" className={cn(iconButton, 'size-8 bg-border text-foreground max-lg:size-8')} aria-label="Xóa từ khóa" onClick={() => edit('')}><X size={16} /></button>
          )}
        </div>
        {showList && <SearchSuggestions listId={listId} draft={draft} options={options} active={active} onPick={pick} />}
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
