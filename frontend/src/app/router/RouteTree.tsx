import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext } from "react-router-dom";
import { ROUTE, TAB_PATH, tabFromPath } from "./routes";

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
        {/* Existing URLs can contain trailing IDs; detail screens are a separate migration. */}
        <Route path="chat/*" element={<CurrentPage />} />
        <Route path="profile/*" element={<CurrentPage />} />
        <Route path="feed/*" element={<CurrentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
