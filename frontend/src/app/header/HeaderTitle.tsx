import type { Tab } from "../../shared/types/navigation";
import type { GroupWorkspaceMode } from "../../features/chat/components/CommunityGroupsPage";
import type { DesktopSection } from "./headerContext";

export type HeaderTitleProps = {
  tab: Tab;
  searchResults?: boolean;
  desktopSection: DesktopSection;
  translationSettingsOpen: boolean;
  groupWorkspaceMode: GroupWorkspaceMode;
  groupCreateStep: number;
  activeConversationName?: string;
  contactsDirectory: boolean;
  contactsOverview?: boolean;
  profileSettings: boolean;
  profileDesktop: boolean;
  profileEditing: boolean;
};

function groupTitle(p: HeaderTitleProps) {
  if (p.groupWorkspaceMode === "create") return p.groupCreateStep === 1 ? "Tạo cộng đồng mới" : "Tạo nhóm mới";
  if (p.groupWorkspaceMode === "manage") return "Quản trị nhóm";
  if (p.groupWorkspaceMode === "channel") return p.activeConversationName || "Kênh trò chuyện nhóm";
  return "Nhóm & cộng đồng";
}

function groupSubtitle(p: HeaderTitleProps) {
  if (p.groupWorkspaceMode === "create") {
    return p.groupCreateStep === 1 ? "Thiết lập không gian riêng cho nhóm" : "Bước " + p.groupCreateStep + "/3 · Chọn thành viên và xác nhận";
  }
  if (p.groupWorkspaceMode === "manage") return "Phân quyền, thành viên và cài đặt cộng đồng";
  if (p.groupWorkspaceMode === "channel") return "Kênh và trò chuyện nhóm";
  return "Quản lý các nhóm của bạn";
}

export default function HeaderTitle(p: HeaderTitleProps) {
  const title: Record<Tab, string> = {
    chat: "Tin nhắn",
    contacts: "Danh bạ",
    notifications: "Thông báo",
    discover: "Khám phá",
    market: "Marketplace",
    feed: "Bảng tin",
    profile: p.profileSettings && p.profileDesktop ? "Cài đặt" : p.profileEditing ? "Chỉnh sửa hồ sơ" : "Hồ sơ cá nhân",
  };
  const subtitle: Record<Tab, string> = {
    chat: p.translationSettingsOpen
      ? "Chọn ngôn ngữ và quyền dịch của cuộc trò chuyện"
      : p.desktopSection === "groups" ? groupSubtitle(p) : "Trò chuyện gần đây và kết nối realtime",
    contacts: "Bạn bè, nhóm, lời mời và lịch sử cuộc gọi",
    notifications: "Cập nhật những hoạt động quan trọng",
    discover: "Tìm người, nhóm và những nội dung thú vị",
    market: "Mua sắm, đăng bán và quản lý đơn hàng",
    feed: "Khoảnh khắc và cộng đồng dành cho bạn",
    profile: p.profileSettings
      ? "Cài đặt tài khoản và quyền riêng tư"
      : p.profileEditing ? "Thông tin cá nhân và quyền hiển thị" : "Trang cá nhân, bài viết và thông tin của bạn",
  };
  const heading = p.searchResults ? "Kết quả tìm kiếm" : p.tab === "chat" && p.translationSettingsOpen
    ? "Ngôn ngữ & dịch AI"
    : p.tab === "chat" && p.desktopSection === "groups"
      ? groupTitle(p)
      : p.tab === "chat" && p.desktopSection === "calls"
        ? "Cuộc gọi"
        : title[p.tab];
  const showSubtitle = p.searchResults || p.translationSettingsOpen ||
    (p.tab === "chat" && p.desktopSection === "groups" && p.groupWorkspaceMode !== "list") ||
    (p.tab === "profile" && (p.profileEditing || p.profileSettings));
  return (
    <div className="app-page-heading">
      <strong>{heading}</strong>
      {showSubtitle && <small>{p.searchResults ? "Tìm người, bài viết, cộng đồng và sản phẩm" : subtitle[p.tab]}</small>}
    </div>
  );
}
