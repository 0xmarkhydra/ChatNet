import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from "react-router-dom";
import { ROUTE, TAB_PATH, chatConversationIdFromPath, fallbackPathForRoute, feedPostIdFromPath, tabFromPath, visitorUsernameFromPath } from "./routes";

function LegacyHomeRedirect() {
  const { search, hash, state } = useLocation();
  const tab = tabFromPath("/", new URLSearchParams(search).get("tab"));
  return <Navigate to={{ pathname: TAB_PATH[tab], search, hash }} state={state} replace />;
}

// The signed-in app owns live feature state; changing routes only replaces its page slot.
function CurrentPage() {
  return useOutletContext<ReactNode>() ?? null;
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
        {Object.values(TAB_PATH).map((path) => (
          <Route key={path} path={path.slice(1)} element={<CurrentPage />} />
        ))}
        {Object.values(ROUTE).map((path) => (
          <Route key={path} path={path.slice(1)} element={<CurrentPage />} />
        ))}
        <Route path="settings/:section" element={<SettingsSectionPage />} />
        <Route path="settings/*" element={<NotFoundPage />} />
        <Route path="calls/history" element={<CurrentPage />} />
        <Route path="calls/directory" element={<CurrentPage />} />
        <Route path="calls/translation" element={<CurrentPage />} />
        <Route path="calls/*" element={<NotFoundPage />} />
        <Route path="chat/:conversationId" element={<ChatConversationPage />} />
        <Route path="users/:username" element={<VisitorProfilePage />} />
        <Route path="users/*" element={<NotFoundPage />} />
        <Route path="contacts/requests" element={<CurrentPage />} />
        <Route path="contacts/*" element={<NotFoundPage />} />
        <Route path="feed/posts/:postId" element={<FeedPostPage />} />
        <Route path="feed/posts/*" element={<NotFoundPage />} />
        <Route path="chat/*" element={<NotFoundPage />} />
        <Route path="profile/*" element={<NotFoundPage />} />
        <Route path="feed/*" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
