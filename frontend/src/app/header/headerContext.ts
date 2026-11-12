import type { Tab } from "../../shared/types/navigation";

export type DesktopSection = "groups" | "calls" | null;

export function searchLabels(tab: Tab) {
  switch (tab) {
    case "notifications":
      return { placeholder: "Tìm kiếm thông báo...", ariaLabel: "Tìm thông báo..." };
    case "contacts":
      return { placeholder: "Tên, @username hoặc email", ariaLabel: "Tìm bạn bằng tên, username hoặc email" };
    case "profile":
      return { placeholder: "Tìm kiếm trên SocCo...", ariaLabel: "Tìm bài viết trên SocCo" };
    case "feed":
      return { placeholder: "Tìm tác giả hoặc nội dung bài viết", ariaLabel: "Tìm bài viết" };
    default:
      return { placeholder: "Tìm liên hệ, tin nhắn, file", ariaLabel: "Tìm cuộc trò chuyện" };
  }
}
