import { Outlet, useOutletContext, useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import PageRoute from "./PageRoute";
import type { AppPageContext } from "./routePageContext";
import { chatConversationIdFromPath, feedPostIdFromPath, visitorUsernameFromPath } from "./routes";

/**
 * Forward the existing page context; no extra DOM wrapper and no new state.
 * Keeping these URL guards outside RouteTree makes its responsibility declarative.
 */
export function FeatureRouteLayout() {
  const page = useOutletContext<AppPageContext>();
  return <Outlet context={page} />;
}

export function CurrentPage() {
  return <PageRoute />;
}

const settingsSections = new Set([
  "account", "privacy", "security", "notifications", "language",
  "messages", "appearance", "storage", "devices",
]);

export function SettingsSectionPage() {
  const { section } = useParams();
  return section && settingsSections.has(section) ? <CurrentPage /> : <NotFoundPage />;
}

export function FeedPostPage() {
  const { postId } = useParams();
  return postId && feedPostIdFromPath(`/feed/posts/${postId}`) !== null
    ? <CurrentPage /> : <NotFoundPage />;
}

export function VisitorProfilePage() {
  const { username } = useParams();
  return username && visitorUsernameFromPath(`/users/${encodeURIComponent(username)}`) !== null
    ? <CurrentPage /> : <NotFoundPage />;
}

export function ChatConversationPage() {
  const { conversationId } = useParams();
  return conversationId && chatConversationIdFromPath(`/chat/${conversationId}`) !== null
    ? <CurrentPage /> : <NotFoundPage />;
}
