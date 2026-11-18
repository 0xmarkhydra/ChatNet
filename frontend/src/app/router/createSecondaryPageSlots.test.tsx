import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createSecondaryPageSlots, type SecondaryPageProps } from "./createSecondaryPageSlots";

const renders = vi.hoisted(() => ({ notifications: 0, contacts: 0, search: 0, discover: 0, market: 0 }));
vi.mock("../../features/notifications/components/NotificationsSection", () => ({
  default: () => { renders.notifications++; return <p>Notifications</p>; },
}));
vi.mock("../../features/contacts/components/UnifiedContactsPage", () => ({
  default: () => { renders.contacts++; return <p>Contacts</p>; },
}));
vi.mock("../../features/search/SearchResultsPage", () => ({
  default: () => { renders.search++; return <p>Search</p>; },
}));
vi.mock("../../features/discover/components/DiscoverSection", () => ({
  default: () => { renders.discover++; return <p>Discover</p>; },
}));
vi.mock("../../features/discover/components/MarketSection", () => ({
  default: () => { renders.market++; return <p>Market</p>; },
}));

describe("secondary feature page composition", () => {
  it("creates only the five secondary page slots without mounting inactive pages", () => {
    Object.keys(renders).forEach(key => { renders[key as keyof typeof renders] = 0; });
    const props = {
      notifications: { conversations: [] },
      contacts: { userId: 1 },
      search: { sessionId: "session-1" },
      discover: { nearbyUsers: [] },
      market: { searchQuery: "market" },
    } as unknown as SecondaryPageProps;
    const slots = createSecondaryPageSlots(props);
    expect(Object.keys(slots)).toEqual(["notifications", "contacts", "search", "discover", "market"]);
    expect(Object.values(slots).every(isValidElement)).toBe(true);
    expect(renders).toEqual({ notifications: 0, contacts: 0, search: 0, discover: 0, market: 0 });
    expect(isValidElement(slots.contacts) && slots.contacts.props).toMatchObject(props.contacts);
    expect(renderToStaticMarkup(<>{slots.contacts}</>)).toContain("Contacts");
    expect(renders).toEqual({ notifications: 0, contacts: 1, search: 0, discover: 0, market: 0 });
  });
});
