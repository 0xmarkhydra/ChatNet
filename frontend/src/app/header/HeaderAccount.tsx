import { useUiTranslation } from '@/shared/i18n/locale'
import UserAvatar from "../../shared/ui/UserAvatar";
import { Button } from "../../shared/ui/button";
import { cn } from "../../shared/lib/utils";

type HeaderAccountProps = {
  variant: "profile" | "settings";
  username: string;
  displayName: string;
  onClick: () => void;
  desktopOnly?: boolean;
};

/** "profile" opens the profile page; "settings" is the profile-page variant that opens settings. */
export default function HeaderAccount({ variant, username, displayName, onClick, desktopOnly = false }: HeaderAccountProps) {
  const trUi = useUiTranslation()

  const settings = variant === "settings";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("app-header-account", settings ? "profile-page-header-account" : "social-feed-header-account", desktopOnly && "app-header-account-desktop-only")}
      type="button"
      aria-label={settings ? trUi("settings.openAccountSettings") : trUi("profile.openProfile")}
      onClick={onClick}
    >
      <UserAvatar
        username={username}
        name={displayName}
        className={`app-header-avatar ${settings ? "profile-page-header-avatar" : "social-feed-header-avatar"}`}
      />
    </Button>
  );
}