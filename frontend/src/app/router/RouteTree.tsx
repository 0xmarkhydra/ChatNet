import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from "react-router-dom";
import { ROUTE, TAB_PATH, chatConversationIdFromPath, fallbackPathForRoute, feedPostIdFromPath, tabFromPath, visitorUsernameFromPath } from "./routes";

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
  return useOutletContext<ReactNode>() ?? null;
}

/**
 * Route-only nested layout: forward the shell's existing page outlet context to
 * feature children without adding DOM or remounting auth/realtime providers.
 */
function FeatureRouteLayout() {
  const page = useOutletContext<ReactNode>();
  return <Outlet context={page} />;
}

function NotFoundPage() {
  const { pathname } = useLocation();
  const fallbackPath = fallbackPathForRoute(pathname);
  const fallbackLabel = fallbackPath === TAB_PATH.chat ? "Tin nhắn"
    : fallbackPath === TAB_PATH.feed ? "Bảng tin"
    : fallbackPath === TAB_PATH.profile ? "Hồ sơ"
    : fallbackPath === ROUTE.settings ? "Cài đặt"
    : fallbackPath === ROUTE.calls ? "Cuộc gọi"
    : fallbackPath === TAB_PATH.contacts ? "Danh bạ"
    : fallbackPath === TAB_PATH.discover ? "Khám phá"
    : fallbackPath === TAB_PATH.market ? "Marketplace" : "Thông báo";
  return (
    <section className="phone-frame modern-frame" aria-labelledby="route-not-found-title">
      <div className="soco-empty-state">
        <h1 id="route-not-found-title">Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại hoặc chưa được hỗ trợ.</p>
        <Link to={fallbackPath}>Về {fallbackLabel}</Link>
      </div>
    </section>
  );
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
          <Route index element={<CurrentPage />} />
          <Route path="directory" element={<CurrentPage />} />
          <Route path="requests" element={<CurrentPage />} />
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
          <Route index element={<CurrentPage />} />
          <Route path="history" element={<CurrentPage />} />
          <Route path="directory" element={<CurrentPage />} />
          <Route path="translation" element={<CurrentPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="users" element={<FeatureRouteLayout />}>
          <Route index element={<NotFoundPage />} />
          <Route path=":username" element={<VisitorProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {[TAB_PATH.discover, TAB_PATH.market, TAB_PATH.notifications].map((path) => (
          <Route key={path} path={path.slice(1)} element={<CurrentPage />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}