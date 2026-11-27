import { useUiTranslation } from '@/shared/i18n/locale'
import { Link, useLocation } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";
import { ROUTE, TAB_PATH, fallbackPathForRoute } from "./routes";

/** Standalone invalid-route page that preserves the existing shell and CSS. */
export default function NotFoundPage() {
  const trUi = useUiTranslation()

  const { pathname } = useLocation();
  const fallbackPath = fallbackPathForRoute(pathname);
  const fallbackLabel = fallbackPath === TAB_PATH.chat ? "Tin nhắn"
    : fallbackPath === TAB_PATH.feed ? "Bảng tin"
    : fallbackPath === TAB_PATH.profile ? "Hồ sơ"
    : fallbackPath === ROUTE.settings ? "Cài đặt"
    : (fallbackPath === ROUTE.calls || fallbackPath === "/contacts/calls") ? "Cuộc gọi"
    : fallbackPath === TAB_PATH.contacts ? "Danh bạ"
    : fallbackPath === TAB_PATH.discover ? "Khám phá"
    : fallbackPath === TAB_PATH.market ? "Marketplace" : "Thông báo";
  return (
    <AppPageErrorBoundary>
      <section className="phone-frame modern-frame" aria-labelledby="route-not-found-title">
      <div className="soco-empty-state">
        <h1 id="route-not-found-title">{trUi("app.notFound")}</h1>
        <p>{trUi("app.notFoundHint")}</p>
        <Link to={fallbackPath}>{trUi("common.backShort") + ' '}{fallbackLabel}</Link>
      </div>
      </section>
    </AppPageErrorBoundary>
  );
}
