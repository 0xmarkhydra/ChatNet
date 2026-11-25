import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CornerDownLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { SearchField } from '@/shared/ui/search-field'
import { useSuggestions, type SuggestConfig, type Suggestion } from '../hooks/useSuggestions'
import type { SearchType } from '../lib/searchFilters'
import SearchSuggestions from './SearchSuggestions'

export type SearchFormProps = {
  initialQuery: string
  placeholder: string
  /** Full-width form for the no-keyword home: submit button next to the field. */
  large?: boolean
  autoFocus?: boolean
  className?: string
  /** Typeahead: the draft, the user's past searches, and matching people and communities. */
  suggest: SuggestConfig
  onSubmit: (query: string, scope: SearchType) => void
}

/** Owns only the draft text; the committed query lives in the URL and replaces the draft whenever it changes. */
export default function SearchForm({ initialQuery, placeholder, large = false, autoFocus = false, className, suggest, onSubmit }: SearchFormProps) {
  const listId = useId()
  const [draft, setDraft] = useState(initialQuery)
  const [committed, setCommitted] = useState(initialQuery)
  if (committed !== initialQuery) { setCommitted(initialQuery); setDraft(initialQuery) }
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
    if (draft.trim()) onSubmit(draft.trim().slice(0, 120), 'all')
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
        <SearchField role="combobox" aria-label="Tìm kiếm trên SocCo" aria-autocomplete="list" aria-expanded={showList} aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList ? listId + '-' + active : undefined} autoComplete="off" maxLength={120} placeholder={placeholder} autoFocus={autoFocus} enterKeyHint="search"
          value={draft} onValueChange={edit} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
          trailing={large ? (
            <Button type="submit" size="icon" aria-label="Tìm kiếm" className="-mr-3 h-auto w-12 shrink-0 self-stretch rounded-l-none rounded-r-ui-md bg-secondary text-primary shadow-[inset_1px_0_0_var(--soco-line)] transition-colors hover:bg-primary hover:text-white disabled:bg-transparent disabled:text-muted-foreground/60 disabled:opacity-100" disabled={!draft.trim()}><CornerDownLeft size={16} strokeWidth={2.4} aria-hidden="true" /></Button>
          ) : undefined} />
        {showList && <SearchSuggestions listId={listId} draft={draft} options={options} active={active} onPick={pick} />}
      </div>
    </form>
  )
}
