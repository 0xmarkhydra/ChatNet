import { Link, useLocation } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";
import { ROUTE, TAB_PATH, fallbackPathForRoute } from "./routes";

const FALLBACK_LABELS: Record<string, string> = {
  [TAB_PATH.chat]: "Tin nhắn",
  [TAB_PATH.feed]: "Bảng tin",
  [TAB_PATH.profile]: "Hồ sơ",
  [ROUTE.settings]: "Cài đặt",
  "/contacts/calls": "Cuộc gọi",
  [TAB_PATH.contacts]: "Danh bạ",
  [TAB_PATH.discover]: "Khám phá",
  [TAB_PATH.market]: "Marketplace",
  [TAB_PATH.notifications]: "Thông báo",
};

/** Standalone invalid-route page that preserves the existing shell and CSS. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const fallbackPath = fallbackPathForRoute(pathname);
  const fallbackLabel = FALLBACK_LABELS[fallbackPath] ?? "Tin nhắn";
  return (
    <AppPageErrorBoundary>
      <section className="phone-frame modern-frame" aria-labelledby="route-not-found-title">
      <div className="soco-empty-state">
        <h1 id="route-not-found-title">Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại hoặc chưa được hỗ trợ.</p>
        <Link to={fallbackPath}>Về {fallbackLabel}</Link>
      </div>
      </section>
    </AppPageErrorBoundary>
  );
}
