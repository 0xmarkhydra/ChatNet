import UserAvatar from "../../shared/ui/UserAvatar";

type HeaderAccountProps = {
  variant: "profile" | "settings";
  username: string;
  displayName: string;
  onClick: () => void;
  desktopOnly?: boolean;
};

/** "profile" opens the profile page; "settings" is the profile-page variant that opens settings. */
export default function HeaderAccount({ variant, username, displayName, onClick, desktopOnly = false }: HeaderAccountProps) {
  const settings = variant === "settings";
  return (
    <button
      className={`app-header-account ${settings ? "profile-page-header-account" : "social-feed-header-account"}${desktopOnly ? " app-header-account-desktop-only" : ""}`}
      type="button"
      aria-label={settings ? "Mở cài đặt tài khoản" : "Mở trang cá nhân"}
      onClick={onClick}
    >
      <UserAvatar
        username={username}
        name={displayName}
        className={`app-header-avatar ${settings ? "profile-page-header-avatar" : "social-feed-header-avatar"}`}
      />
    </button>
  );
}