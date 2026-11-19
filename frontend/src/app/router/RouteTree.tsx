import LegacyHomeRedirect from "./LegacyHomeRedirect";
import NotFoundPage from "./NotFoundPage";
import type { ReactNode } from "react";
import PageRoute from "./PageRoute";
import { ChatConversationPage, FeatureRouteLayout, FeedPostPage, SettingsSectionPage, VisitorProfilePage } from "./FeatureRoutePages";
import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTE, TAB_PATH } from "./routes";

export function AppRouteTree({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<>{children}</>}>
        <Route index element={<LegacyHomeRedirect />} />
        <Route path={TAB_PATH.chat.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<PageRoute page="chat" />} />
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
          <Route index element={<PageRoute page="feed" />} />
          <Route path="posts/:postId" element={<FeedPostPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={TAB_PATH.profile.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<PageRoute page="profile" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path={ROUTE.settings.slice(1)} element={<FeatureRouteLayout />}>
          <Route index element={<PageRoute page="profile" />} />
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