import type { ComponentProps } from "react";
import UnifiedContactsPage from "../../features/contacts/components/UnifiedContactsPage";
import NotificationsSection from "../../features/notifications/components/NotificationsSection";
import DiscoverSection from "../../features/discover/components/DiscoverSection";
import SearchResultsPage from "../../features/search/SearchResultsPage";
import MarketSection from "../../features/discover/components/MarketSection";
import type { AppPageContext } from "./routePageContext";

type SecondaryPageKey = "notifications" | "contacts" | "search" | "discover" | "market";

export type SecondaryPageProps = {
  notifications: ComponentProps<typeof NotificationsSection>;
  contacts: ComponentProps<typeof UnifiedContactsPage>;
  search: ComponentProps<typeof SearchResultsPage>;
  discover: ComponentProps<typeof DiscoverSection>;
  market: ComponentProps<typeof MarketSection>;
};

/** Compose route-owned page nodes without mounting inactive pages or owning state. */
export function createSecondaryPageSlots(props: SecondaryPageProps): Pick<AppPageContext, SecondaryPageKey> {
  return {
    notifications: <NotificationsSection {...props.notifications} />,
    contacts: <UnifiedContactsPage {...props.contacts} />,
    search: <SearchResultsPage {...props.search} />,
    discover: <DiscoverSection {...props.discover} />,
    market: <MarketSection {...props.market} />,
  };
}
