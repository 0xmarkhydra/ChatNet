import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from "react-router-dom";
import { ROUTE, TAB_PATH, chatConversationIdFromPath, feedPostIdFromPath, tabFromPath, visitorUsernameFromPath } from "./routes";

function LegacyHomeRedirect() {
  const { search } = useLocation();
  const tab = tabFromPath("/", new URLSearchParams(search).get("tab"));
  return <Navigate to={{ pathname: TAB_PATH[tab], search }} replace />;
}

// The signed-in app owns live feature state; changing routes only replaces its page slot.
function CurrentPage() {
  return useOutletContext<ReactNode>() ?? null;
}

function NotFoundPage() {
  return (
    <section className="phone-frame modern-frame" aria-labelledby="route-not-found-title">
      <div className="soco-empty-state">
        <h1 id="route-not-found-title">Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại hoặc chưa được hỗ trợ.</p>
        <Link to={TAB_PATH.chat}>Về Tin nhắn</Link>
      </div>
    </section>
  );
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
        <Route path="chat/:conversationId" element={<ChatConversationPage />} />
        <Route path="users/:username" element={<VisitorProfilePage />} />
        <Route path="users/*" element={<NotFoundPage />} />
        <Route path="contacts/requests" element={<CurrentPage />} />
        <Route path="contacts/*" element={<NotFoundPage />} />
        <Route path="feed/posts/:postId" element={<FeedPostPage />} />
        <Route path="feed/posts/*" element={<NotFoundPage />} />
        <Route path="chat/*" element={<NotFoundPage />} />
        <Route path="profile/*" element={<CurrentPage />} />
        <Route path="feed/*" element={<CurrentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
