import type { NavigateFunction } from 'react-router-dom'
import type { Tab } from '../../shared/types/navigation'

export type AppTabSwitchDependencies = {
  setDesktopSection: (value: null) => void
  setFeedCommunitiesOpen: (value: boolean) => void
  setTranslationSettingsConversationId: (value: number | null) => void
  setProfileEditorOpen: (value: boolean) => void
  activePostId: number | null
  setActivePostId: (value: number | null) => void
  routeLocation: { pathname: string; search: string }
  navigate: NavigateFunction
  setQuickSearchOpen: (value: boolean) => void
  setTab: (tab: Tab) => void
  setQuickCreateOpen: (value: boolean) => void
  setGlobalSearch: (value: string) => void
  setActiveConversationId: (value: number | null) => void
  setFriendQuery: (value: string) => void
}

/** Keeps route cleanup and tab UI teardown together, in their original order. */
export function createAppTabSwitch({
  setDesktopSection, setFeedCommunitiesOpen, setTranslationSettingsConversationId,
  setProfileEditorOpen, activePostId, setActivePostId, routeLocation, navigate,
  setQuickSearchOpen, setTab, setQuickCreateOpen, setGlobalSearch,
  setActiveConversationId, setFriendQuery,
}: AppTabSwitchDependencies) {
  const switchTab = (nextTab: Tab) => {
    setDesktopSection(null);
    setFeedCommunitiesOpen(false);
    setTranslationSettingsConversationId(null);

    if (nextTab === "profile") {
      // setTab owns the URL; a second Settings setter would push /profile twice.
      setProfileEditorOpen(false);
    }
    if (activePostId !== null) {
      setActivePostId(null);
      if (new URLSearchParams(routeLocation.search).has("post")) {
        navigate({ pathname: routeLocation.pathname, search: "" }, { replace: true });
      }
    }
    setQuickSearchOpen(false);
    setTab(nextTab);
    setQuickCreateOpen(false);
    setGlobalSearch("");
    if (nextTab !== "chat") setActiveConversationId(null);
    if (nextTab !== "contacts") setFriendQuery("");
  };
  return switchTab
}
