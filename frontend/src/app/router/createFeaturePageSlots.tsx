import type { ComponentProps, ReactNode } from "react";
import UnifiedContactsPage from "../../features/contacts/components/UnifiedContactsPage";
import NotificationsSection from "../../features/notifications/components/NotificationsSection";
import DiscoverSection from "../../features/discover/components/DiscoverSection";
import SearchResultsPage from "../../features/search/SearchResultsPage";
import MarketSection from "../../features/discover/components/MarketSection";
import type { RoutePageKey } from "./routePageContext";

/**
 * Route-owned feature page composition, independent of App Shell state/effects.
 * React elements are created but not mounted until the route selects the slot.
 * The persistent AuthedApp continues to own the data and callback lifecycles.
 */
export type FeaturePageSlotProps = {
  notifications: ComponentProps<typeof NotificationsSection>;
  contacts: ComponentProps<typeof UnifiedContactsPage>;
  search: ComponentProps<typeof SearchResultsPage>;
  discover: ComponentProps<typeof DiscoverSection>;
  market: ComponentProps<typeof MarketSection>;
};

export function createFeaturePageSlots(props: FeaturePageSlotProps): Record<RoutePageKey, ReactNode> {
  return {
    notifications: <NotificationsSection {...props.notifications} />,
    contacts: <UnifiedContactsPage {...props.contacts} />,
    search: <SearchResultsPage {...props.search} />,
    discover: <DiscoverSection {...props.discover} />,
    market: <MarketSection {...props.market} />,
  };
}
