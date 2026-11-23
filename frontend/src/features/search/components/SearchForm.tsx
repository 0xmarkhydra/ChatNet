import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'

export type SearchFormProps = {
  initialQuery: string
  placeholder: string
  large?: boolean
  autoFocus?: boolean
  onSubmit: (query: string) => void
}

/** Owns only the draft text; the committed query lives in the URL. Remount with a key to reset. */
export default function SearchForm({ initialQuery, placeholder, large = false, autoFocus = false, onSubmit }: SearchFormProps) {
  const [draft, setDraft] = useState(initialQuery)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) onSubmit(draft.trim().slice(0, 120))
  }

  return (
    <form className={large ? 'srch-form large' : 'srch-form'} role="search" onSubmit={submit}>
      <Search size={large ? 20 : 18} aria-hidden="true" />
      <input type="search" aria-label="Tìm kiếm trên SocCo" value={draft} maxLength={120} placeholder={placeholder}
        autoFocus={autoFocus} enterKeyHint="search" onChange={event => setDraft(event.target.value)} />
      {draft && (
        <button type="button" className="srch-icon-btn" aria-label="Xóa từ khóa" onClick={() => setDraft('')}><X size={16} /></button>
      )}
      {large && <button type="submit" className="srch-btn" disabled={!draft.trim()}>Tìm kiếm</button>}
    </form>
  )
}
