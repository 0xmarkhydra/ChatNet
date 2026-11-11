import type { Tab } from "../types";
import type { GroupWorkspaceMode } from "../../features/chat/components/CommunityGroupsPage";
import type { DesktopSection } from "./headerContext";

export type HeaderTitleProps = {
  tab: Tab;
  desktopSection: DesktopSection;
  translationSettingsOpen: boolean;
  groupWorkspaceMode: GroupWorkspaceMode;
  groupCreateStep: number;
  activeConversationName?: string;
  contactsDirectory: boolean;
  feedPostOpenOnDesktop: boolean;
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
    contacts: p.contactsDirectory ? "Bạn bè" : "Lời mời kết bạn",
    notifications: "Thông báo",
    discover: "Khám phá",
    market: "Marketplace",
    feed: p.feedPostOpenOnDesktop ? "Bình luận" : "Bảng tin",
    profile: p.profileSettings && p.profileDesktop ? "Cài đặt" : p.profileEditing ? "Chỉnh sửa hồ sơ" : "Hồ sơ cá nhân",
  };
  const subtitle: Record<Tab, string> = {
    chat: p.translationSettingsOpen
      ? "Chọn ngôn ngữ và quyền dịch của cuộc trò chuyện"
      : p.desktopSection === "groups" ? groupSubtitle(p) : "Trò chuyện gần đây và kết nối bạn bè",
    contacts: p.contactsDirectory ? "Tìm kiếm và kết nối với bạn bè" : "Gửi, nhận và quản lý yêu cầu kết nối",
    notifications: "Cập nhật những hoạt động quan trọng",
    discover: "Khám phá và kết nối cộng đồng",
    market: "Khám phá sản phẩm và cửa hàng",
    feed: p.feedPostOpenOnDesktop ? "Tương tác với mọi người trong cộng đồng" : "Khoảnh khắc và cộng đồng dành cho bạn",
    profile: p.profileSettings
      ? "Cài đặt tài khoản và quyền riêng tư"
      : p.profileEditing ? "Thông tin cá nhân và quyền hiển thị" : "Trang cá nhân, bài viết và thông tin của bạn",
  };
  const heading = p.tab === "chat" && p.translationSettingsOpen
    ? "Ngôn ngữ & dịch AI"
    : p.tab === "chat" && p.desktopSection === "groups"
      ? groupTitle(p)
      : p.tab === "chat" && p.desktopSection === "calls"
        ? "Cuộc gọi"
        : title[p.tab];
  return (
    <div className="app-page-heading">
      <strong>{heading}</strong>
      <small>{subtitle[p.tab]}</small>
    </div>
  );
}
