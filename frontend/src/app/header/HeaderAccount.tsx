import UserAvatar from "../../shared/ui/UserAvatar";

type HeaderAccountProps = {
  variant: "profile" | "settings";
  username: string;
  displayName: string;
  onClick: () => void;
};

/** "profile" opens the profile page; "settings" is the profile-page variant that opens settings. */
export default function HeaderAccount({ variant, username, displayName, onClick }: HeaderAccountProps) {
  const settings = variant === "settings";
  return (
    <button
      className={settings ? "profile-page-header-account" : "social-feed-header-account"}
      type="button"
      aria-label={settings ? "Mở cài đặt tài khoản" : "Mở trang cá nhân"}
      onClick={onClick}
    >
      <UserAvatar
        username={username}
        name={displayName}
        className={settings ? "profile-page-header-avatar" : "social-feed-header-avatar"}
      />
    </button>
  );
}
