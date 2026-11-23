import { Clock, Search, UsersRound } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { Suggestion } from '../hooks/useSuggestions'
import { foldText } from '../lib/searchFilters'
import { plainButton } from './ui'

export type SearchSuggestionsProps = {
  listId: string
  draft: string
  options: Suggestion[]
  active: number
  onPick: (option: Suggestion) => void
}

const row = 'flex w-full items-center gap-ui-3 rounded-ui-md px-ui-3 text-left hover:bg-muted'
const heading = 'm-0 mt-ui-2 mb-ui-1 px-ui-3 text-[length:var(--soco-type-caption)] font-semibold tracking-wide text-muted-foreground uppercase'

/** Keep what the user typed regular and emphasise the completion. */
function Completion({ text, draft }: { text: string; draft: string }) {
  const typed = draft.trim()
  if (!foldText(text).startsWith(foldText(typed)) || text.length <= typed.length) return <>{text}</>
  return <>{text.slice(0, typed.length)}<strong className="font-bold">{text.slice(typed.length)}</strong></>
}

export default function SearchSuggestions({ listId, draft, options, active, onPick }: SearchSuggestionsProps) {
  const sections = [
    { title: '', items: options.filter(option => option.kind === 'query') },
    { title: 'Mọi người', items: options.filter(option => option.kind === 'person') },
    { title: 'Cộng đồng', items: options.filter(option => option.kind === 'community') },
  ].filter(section => section.items.length > 0)

  return (
    <div id={listId} role="listbox" aria-label="Gợi ý tìm kiếm"
      className="absolute top-full right-0 left-0 z-20 mt-ui-2 rounded-ui-lg border border-border bg-card p-ui-2 text-foreground shadow-ui-overlay">
      {sections.map(section => (
        <div key={section.title || 'queries'} role="presentation">
          {section.title && <p className={heading} role="presentation">{section.title}</p>}
          {section.items.map(option => {
            const index = options.indexOf(option)
            const selected = index === active
            return (
              <div key={option.id} id={listId + '-' + index} role="option" aria-selected={selected}
                className={cn(plainButton, row, option.kind === 'query' ? 'min-h-11' : 'min-h-14', selected && 'bg-secondary hover:bg-secondary')}
                onMouseDown={event => event.preventDefault()} onClick={() => onPick(option)}>
                {option.kind === 'query' && (
                  <>
                    {option.fromHistory ? <Clock size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate text-[length:var(--soco-type-body)]"><Completion text={option.query} draft={draft} /></span>
                    {selected && !option.fromHistory
                      ? <span className="shrink-0 text-[length:var(--soco-type-caption)] font-semibold text-primary">Enter</span>
                      : option.fromHistory && <span className="shrink-0 text-[length:var(--soco-type-caption)] text-muted-foreground max-sm:hidden">Đã tìm trước đây</span>}
                  </>
                )}
                {option.kind === 'person' && (
                  <>
                    <UserAvatar name={option.title} username={option.username} className="avatar size-9 shrink-0 text-[length:var(--soco-type-caption)] font-bold" />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-[length:var(--soco-type-body)] font-semibold">{option.title}</span>
                      <span className="truncate text-[length:var(--soco-type-caption)] text-muted-foreground">@{option.username}</span>
                    </span>
                  </>
                )}
                {option.kind === 'community' && (
                  <>
                    <span className="inline-grid size-9 shrink-0 place-items-center rounded-ui-sm bg-secondary text-primary" aria-hidden="true"><UsersRound size={18} /></span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-[length:var(--soco-type-body)] font-semibold">{option.name}</span>
                      <span className="truncate text-[length:var(--soco-type-caption)] text-muted-foreground">{option.subtitle}</span>
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
