import { Outlet, useOutletContext, useParams } from "react-router-dom";
import type { AppPageContext } from "./PageRoute";
import PageRoute from "./PageRoute";
import NotFoundPage from "./NotFoundPage";
import { chatConversationIdFromPath, feedPostIdFromPath, visitorUsernameFromPath } from "./routes";

/**
 * Nested URL handling lives outside the route configuration.
 * Guards validate deep links without remounting the authenticated App Shell,
 * chat/outbox state, call manager or providers.
 */
export function FeatureRouteLayout() {
  const page = useOutletContext<AppPageContext>();
  return <Outlet context={page} />;
}

const settingsSections = new Set([
  "account", "privacy", "security", "notifications", "language",
  "messages", "appearance", "storage", "devices",
]);

export function SettingsSectionPage() {
  const { section } = useParams();
  return section && settingsSections.has(section) ? <PageRoute /> : <NotFoundPage />;
}

export function FeedPostPage() {
  const { postId } = useParams();
  return postId && feedPostIdFromPath(`/feed/posts/${postId}`) !== null
    ? <PageRoute />
    : <NotFoundPage />;
}

export function VisitorProfilePage() {
  const { username } = useParams();
  return username && visitorUsernameFromPath(`/users/${encodeURIComponent(username)}`) !== null
    ? <PageRoute />
    : <NotFoundPage />;
}

export function ChatConversationPage() {
  const { conversationId } = useParams();
  return conversationId && chatConversationIdFromPath(`/chat/${conversationId}`) !== null
    ? <PageRoute />
    : <NotFoundPage />;
}
