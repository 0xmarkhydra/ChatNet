import type { RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { Tab } from '../../shared/types/navigation'
import type { ComponentProps } from 'react'
import ChatQuickSearch from '../../features/chat/components/ChatQuickSearch'
import HeaderSearch from './HeaderSearch'
import UiIcon from '../../shared/ui/UiIcon'
import { searchLabels } from './headerContext'

type Results = ComponentProps<typeof ChatQuickSearch>

type Props = {
  tab: Tab
  anchorRef: RefObject<HTMLDivElement | null>
  friendQuery: string
  globalSearch: string
  conversationSearching: boolean
  quickSearchOpen: boolean
  setQuickSearchOpen: (value: boolean) => void
  setFriendQuery: (value: string) => void
  setGlobalSearch: (value: string) => void
  setTab: (tab: Tab) => void
  navigate: NavigateFunction
  results: Results['results']
  loading: Results['loading']
  error: Results['error']
  retry: Results['onRetry']
  onContact: Results['onContact']
  onHit: Results['onHit']
}

/** Shared header search behavior, including route-aware chat and profile interactions. */
export default function AppQuickSearch({
  tab, anchorRef, friendQuery, globalSearch, conversationSearching,
  quickSearchOpen, setQuickSearchOpen, setFriendQuery, setGlobalSearch,
  setTab, navigate, results, loading, error, retry, onContact, onHit,
}: Props) {
  const searchText = searchLabels(tab)
  return (
    <HeaderSearch
      anchorRef={anchorRef}
      icon={<UiIcon name="search" size={27} />}
      value={tab === 'contacts' ? friendQuery : globalSearch}
      maxLength={tab === 'feed' || tab === 'chat' ? 120 : undefined}
      placeholder={searchText.placeholder}
      ariaLabel={searchText.ariaLabel}
      onMobileSearchOpen={tab === 'chat' ? undefined : () => navigate('/search')}
      expanded={tab === 'chat' && conversationSearching && quickSearchOpen}
      controls={tab === 'chat' ? 'chat-quick-search-results' : undefined}
      onKeyDown={(event) => {
        if (tab === 'discover' && event.key === 'Enter') {
          event.preventDefault()
          navigate('/search?q=' + encodeURIComponent(globalSearch.trim()))
        }
        if (tab === 'chat' && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setQuickSearchOpen(false)
        }
      }}
      onFocus={() => {
        if (tab === 'chat' && globalSearch.trim()) setQuickSearchOpen(true)
      }}
      onClick={() => {
        if (tab === 'chat' && globalSearch.trim()) setQuickSearchOpen(true)
      }}
      onChange={(value) => {
        if (tab === 'contacts') setFriendQuery(value)
        else if (tab === 'profile') {
          setGlobalSearch(value)
          setTab('feed')
        } else {
          setGlobalSearch(value)
          if (tab === 'chat') setQuickSearchOpen(Boolean(value.trim()))
        }
      }}
      results={tab === 'chat' && conversationSearching && quickSearchOpen ? (
        <ChatQuickSearch
          results={results}
          loading={loading}
          error={error}
          onRetry={retry}
          onClose={() => setQuickSearchOpen(false)}
          onContact={onContact}
          onHit={onHit}
        />
      ) : undefined}
    />
  )
}