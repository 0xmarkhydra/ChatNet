import NotFoundPage from "./NotFoundPage";
import type { ReactNode } from "react";
import PageRoute, { type AppPageContext } from "./PageRoute";
import { Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from "react-router-dom";
import { ROUTE, TAB_PATH, chatConversationIdFromPath, feedPostIdFromPath, tabFromPath, visitorUsernameFromPath } from "./routes";

function LegacyHomeRedirect() {
  const { search, hash, state } = useLocation();
  const params = new URLSearchParams(search);
  const tab = tabFromPath("/", params.get("tab"));
  params.delete("tab");
  const remaining = params.toString();
  return <Navigate to={{ pathname: TAB_PATH[tab], search: remaining ? `?${remaining}` : "", hash }} state={state} replace />;
}

// The signed-in app owns live feature state; changing routes only replaces its page slot.
function CurrentPage() {
  return <PageRoute />;
}

/**
 * Route-only nested layout: forward the shell's existing page outlet context to
 * feature children without adding DOM or remounting auth/realtime providers.
 */
function FeatureRouteLayout() {
  const page = useOutletContext<AppPageContext>();
  return <Outlet context={page} />;
}

const settingsSections = new Set([
  "account", "privacy", "security", "notifications", "language",
  "messages", "appearance", "storage", "devices",
]);

function SettingsSectionPage() {
  const { section } = useParams();
  return section && settingsSections.has(section) ? <CurrentPage /> : <NotFoundPage />;
}

function FeedPostPage() {
  const { postId } = useParams();
  return postId && feedPostIdFromPath(`/feed/posts/${postId}`) !== null
    ? <CurrentPage />
    : <NotFoundPage />;
}

function VisitorProfilePage() {
  const { username } = useParams();
  return username && visitorUsernameFromPath(`/users/${encodeURIComponent(username)}`) !== null
    ? <CurrentPage />
    : <NotFoundPage />;
}

function ChatConversationPage() {
  const { conversationId } = useParams();
  return conversationId && chatConversationIdFromPath(`/chat/${conversationId}`) !== null
    ? <CurrentPage />
    : <NotFoundPage />;
}

export function AppRouteTree({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<>{children}</>}>
        <Route index element={<LegacyHomeRedirect />} />
        <Route path={TAB_PATH.chat.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<CurrentPage />} />
          <Route path=":conversationId" element={<ChatConversationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={TAB_PATH.contacts.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<PageRoute page="contacts" />} />
          <Route path="directory" element={<PageRoute page="contacts" />} />
          <Route path="overview" element={<PageRoute page="contacts" />} />
          <Route path="groups" element={<PageRoute page="contacts" />} />
          <Route path="requests" element={<PageRoute page="contacts" />} />
          <Route path="calls" element={<PageRoute page="contacts" />} />
          <Route path="translation" element={<PageRoute page="contacts" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={TAB_PATH.feed.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<CurrentPage />} />
          <Route path="posts/:postId" element={<FeedPostPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={TAB_PATH.profile.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<CurrentPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={ROUTE.settings.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<CurrentPage />} />
          <Route path=":section" element={<SettingsSectionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={ROUTE.calls.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<Navigate to="/contacts/calls" replace />} />
          <Route path="history" element={<Navigate to="/contacts/calls" replace />} />
          <Route path="directory" element={<Navigate to="/contacts" replace />} />
          <Route path="translation" element={<Navigate to="/contacts/translation" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="users" element={<FeatureRouteLayout />}>
          <Route index element={<NotFoundPage />} />
          <Route path=":username" element={<VisitorProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={ROUTE.search.slice(1)} element={<PageRoute page="search" />} />
        <Route path={TAB_PATH.discover.slice(1)} element={<PageRoute page="discover" />} />
        <Route path={TAB_PATH.market.slice(1)} element={<PageRoute page="market" />} />
        <Route path={TAB_PATH.notifications.slice(1)} element={<PageRoute page="notifications" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}