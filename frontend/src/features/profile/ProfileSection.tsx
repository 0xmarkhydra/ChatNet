import SettingsWorkspace from "../settings/SettingsWorkspace";
import { PencilLine, Download, LogOut, ChevronDown, Volume2, ArrowLeft, Settings, Images, RefreshCw } from "lucide-react";
import BlockedUsersPanel from "../contacts/BlockedUsersPanel";
import { isDesktopBuild } from "../../platform/desktop";
import AccountSessionsPanel from "../auth/AccountSessionsPanel";
import UserAvatar, { profileAssetUrl } from "../../shared/ui/UserAvatar";
import UiIcon from "../../shared/ui/UiIcon";
import ProfileNote from "./ProfileNote";
import { userLabel } from "../../shared/lib/userLabel";
import MediaAttachmentsView from "../../shared/ui/MediaAttachmentsView";
import { SocoEmptyState, SocoTextAction } from "../../shared/ui/SocoUI";
import type { ManagedAccountSession } from "../auth/types";
import { type Post } from "../feed/types";
import type { UserPrivacy, ProfileMediaState } from "./types";
import { type Session } from "../auth/session";
import { type SetStateAction } from "react";
import type { Tab } from "../../app/types";
import { UI_MESSAGES } from "../i18n/i18n";
import type { LanguageOption } from "../i18n/languages";
import type { Dispatch, RefObject, ReactNode } from "react";

export type ProfileSectionProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  appLocale: string;
  autoTranslate: boolean;
  avatarFileInputRef: RefObject<HTMLInputElement | null>;
  blockedBusy: boolean;
  blockedError: string;
  blockedOpen: boolean;
  blockedUsers: { id: number; username: string; displayName: string; }[];
  changeAppLocale: (nextLocale: string) => Promise<void>;
  changeAutoTranslate: (next: boolean) => void;
  changeTargetLanguage: (next: string) => void;
  closeProfileTimeline: () => void;
  coverFileInputRef: RefObject<HTMLInputElement | null>;
  desktopProfileSettings: boolean;
  fetchAccountSessions: () => Promise<void>;
  installApp: () => Promise<void>;
  isProfileDesktop: boolean;
  isStandalone: boolean;
  loadBlockedUsers: () => Promise<void>;
  loadProfilePosts: (more?: boolean, force?: boolean) => Promise<void>;
  localePickerOpen: boolean;
  localeSearch: string;
  logout: (revoke?: boolean, clearStorage?: boolean) => void;
  managedSessions: ManagedAccountSession[];
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  messageSoundEnabled: boolean;
  name: string;
  nativeNotifications: { enabled: boolean; toggle: () => void; warning: string; };
  pendingPost: Post | null;
  postText: string;
  previewMessageSound: () => Promise<void>;
  privacy: UserPrivacy | null;
  privacyBusy: boolean;
  privacyError: string;
  privacyLoading: boolean;
  profileBusy: "avatar" | "cover" | null;
  profileHasMore: boolean;
  profileHeadingRef: RefObject<HTMLHeadingElement | null>;
  profileIdentityForm: ReactNode;
  profileIdentityRef: RefObject<HTMLButtonElement | null>;
  profileMedia: ProfileMediaState | null;
  profilePosts: Post[];
  profilePostsBusy: boolean;
  profilePostsError: string;
  profilePrivacyControls: ReactNode;
  profileTimelineOpen: boolean;
  pushBusy: boolean;
  pushEnabled: boolean;
  renderPosts: (items: Post[], showSave?: boolean) => ReactNode[];
  revokeAccountSessions: (sessionID?: string) => Promise<void>;
  savePrivacy: (next: UserPrivacy) => Promise<void>;
  selectedAppLanguage: LanguageOption;
  selectedLanguage: LanguageOption;
  sendTestPush: (silent?: boolean, force?: boolean) => Promise<boolean>;
  session: Session;
  sessionsBusy: boolean;
  sessionsError: string;
  sessionsOpen: boolean;
  setBlockedOpen: Dispatch<SetStateAction<boolean>>;
  setDesktopProfileSettings: Dispatch<SetStateAction<boolean>>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setLocalePickerOpen: Dispatch<SetStateAction<boolean>>;
  setLocaleSearch: Dispatch<SetStateAction<string>>;
  setPrivacyRetry: Dispatch<SetStateAction<number>>;
  setProfileComposerOpen: Dispatch<SetStateAction<boolean>>;
  setProfileEditorOpen: Dispatch<SetStateAction<boolean>>;
  setProfileTimelineOpen: Dispatch<SetStateAction<boolean>>;
  setSessionsOpen: Dispatch<SetStateAction<boolean>>;
  setTranslationPickerOpen: Dispatch<SetStateAction<boolean>>;
  setTranslationSettingsSearch: Dispatch<SetStateAction<string>>;
  switchTab: (nextTab: Tab) => void;
  t: (key: keyof typeof UI_MESSAGES) => string;
  targetLanguage: string;
  toggleMessageSound: () => void;
  togglePush: () => Promise<void>;
  translationPickerOpen: boolean;
  translationSettingsSearch: string;
  uiLocaleLoading: boolean;
  unblockContact: (userId: number) => Promise<void>;
  updateProfileImage: (kind: "avatar" | "cover", file?: File) => Promise<void>;
  visibleLocaleOptions: LanguageOption[];
  visibleProfilePosts: Post[];
  visibleTranslationSettingsOptions: LanguageOption[];
};

export default function ProfileSection({
  apiFetch,
  appLocale,
  autoTranslate,
  avatarFileInputRef,
  blockedBusy,
  blockedError,
  blockedOpen,
  blockedUsers,
  changeAppLocale,
  changeAutoTranslate,
  changeTargetLanguage,
  closeProfileTimeline,
  coverFileInputRef,
  desktopProfileSettings,
  fetchAccountSessions,
  installApp,
  isProfileDesktop,
  isStandalone,
  loadBlockedUsers,
  loadProfilePosts,
  localePickerOpen,
  localeSearch,
  logout,
  managedSessions,
  mediaUploading,
  messageSoundEnabled,
  name,
  nativeNotifications,
  pendingPost,
  postText,
  previewMessageSound,
  privacy,
  privacyBusy,
  privacyError,
  privacyLoading,
  profileBusy,
  profileHasMore,
  profileHeadingRef,
  profileIdentityForm,
  profileIdentityRef,
  profileMedia,
  profilePosts,
  profilePostsBusy,
  profilePostsError,
  profilePrivacyControls,
  profileTimelineOpen,
  pushBusy,
  pushEnabled,
  renderPosts,
  revokeAccountSessions,
  savePrivacy,
  selectedAppLanguage,
  selectedLanguage,
  sendTestPush,
  session,
  sessionsBusy,
  sessionsError,
  sessionsOpen,
  setBlockedOpen,
  setDesktopProfileSettings,
  setGlobalSearch,
  setLocalePickerOpen,
  setLocaleSearch,
  setPrivacyRetry,
  setProfileComposerOpen,
  setProfileEditorOpen,
  setProfileTimelineOpen,
  setSessionsOpen,
  setTranslationPickerOpen,
  setTranslationSettingsSearch,
  switchTab,
  t,
  targetLanguage,
  toggleMessageSound,
  togglePush,
  translationPickerOpen,
  translationSettingsSearch,
  uiLocaleLoading,
  unblockContact,
  updateProfileImage,
  visibleLocaleOptions,
  visibleProfilePosts,
  visibleTranslationSettingsOptions,
}: ProfileSectionProps) {
  return (
      <div
            className={`simple-view profile-view ${profileTimelineOpen ? "personal-timeline-view" : ""} ${isProfileDesktop && desktopProfileSettings ? "settings-workspace-open" : ""}`}
          >
            {isProfileDesktop && desktopProfileSettings && (
              <SettingsWorkspace
                privacy={privacy}
                privacyLoading={privacyLoading}
                privacyBusy={privacyBusy}
                privacyError={privacyError}
                onPrivacyRetry={() => setPrivacyRetry((value) => value + 1)}
                onSavePrivacy={savePrivacy}
                account={
                  <div className="settings-workspace-account">
                    <div className="settings-workspace-account-details">
                      <strong>{profileMedia?.displayName || session.user.displayName || name}</strong>
                      <span>@{session.user.username}</span>
                      <span>{session.user.email}</span>
                    </div>
                    <button type="button" className="settings-workspace-action" onClick={() => {
                      setDesktopProfileSettings(false);
                      setProfileEditorOpen(true);
                    }}>
                      <PencilLine size={16} aria-hidden="true" /> Chỉnh sửa hồ sơ
                    </button>
                    {!isStandalone && (
                      <button type="button" className="settings-workspace-action" onClick={() => void installApp()}>
                        <Download size={16} aria-hidden="true" /> {t("profile.install")}
                      </button>
                    )}
                    <button type="button" className="settings-workspace-action" onClick={() => logout()}>
                      <LogOut size={16} aria-hidden="true" /> {t("profile.logout")}
                    </button>
                  </div>
                }
                security={
                  <div className="settings-card">
                    <BlockedUsersPanel
                      blockedBusy={blockedBusy}
                      blockedOpen={blockedOpen}
                      setBlockedOpen={setBlockedOpen}
                      loadBlockedUsers={loadBlockedUsers}
                      blockedError={blockedError}
                      blockedUsers={blockedUsers}
                      unblockContact={unblockContact}
                    />
                  </div>
                }
                notifications={
                  <div className="settings-card">
                    <div className="settings-row">
                      <div>
                        <strong>{isDesktopBuild ? "Thông báo Desktop" : t("profile.notifications")}</strong>
                        <small>{isDesktopBuild
                          ? "Nhận thông báo khi SocCo còn đang chạy."
                          : t("profile.notificationsHint")}</small>
                      </div>
                      <button type="button" role="switch"
                        className={"switch-button" + ((isDesktopBuild ? nativeNotifications.enabled : pushEnabled) ? " on" : "")}
                        aria-checked={isDesktopBuild ? nativeNotifications.enabled : pushEnabled}
                        aria-label={isDesktopBuild ? "Thông báo Desktop" : t("profile.notifications")}
                        disabled={!isDesktopBuild && pushBusy}
                        onClick={() => isDesktopBuild ? nativeNotifications.toggle() : void togglePush()}
                      ><span /></button>
                    </div>
                    {isDesktopBuild && nativeNotifications.warning && (
                      <div className="settings-row" role="status"><small>{nativeNotifications.warning}</small></div>
                    )}
                    {!isDesktopBuild && (
                      <div className="settings-row">
                        <div><strong>{t("profile.testNotification")}</strong><small>{t("profile.testNotificationHint")}</small></div>
                        <button type="button" className="settings-action"
                          disabled={pushBusy || !pushEnabled} onClick={() => void sendTestPush()}>
                          {t("common.test")}
                        </button>
                      </div>
                    )}
                  </div>
                }
                language={
                  <div className="settings-card">
                    <button type="button" className="settings-row settings-row-button app-locale-row"
                      onClick={() => { setLocaleSearch(""); setLocalePickerOpen(true); }}>
                      <div><strong>{t("profile.appLanguage")}</strong><small>{t("profile.appLanguageHint")}</small></div>
                      <span className="settings-current-locale">
                        <span>{appLocale === "auto" ? t("common.auto") : selectedAppLanguage?.localizedLanguage}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </button>
                    <div className="settings-row">
                      <div><strong>{t("profile.autoTranslate")}</strong></div>
                      <button type="button" role="switch" aria-checked={autoTranslate}
                        aria-label={t("profile.autoTranslate")}
                        className={"switch-button" + (autoTranslate ? " on" : "")}
                        onClick={() => changeAutoTranslate(!autoTranslate)}><span /></button>
                    </div>
                    <button type="button" className="settings-row settings-row-button translation-locale-row"
                      onClick={() => { setTranslationSettingsSearch(""); setTranslationPickerOpen(true); }}>
                      <div><strong>{t("profile.translationLanguage")}</strong><small>{t("profile.translationLanguageHint")}</small></div>
                      <span className="settings-current-locale">
                        <span>{selectedLanguage?.localizedLanguage || targetLanguage.toUpperCase()}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                }
                messages={
                  <div className="settings-card">
                    <div className="settings-row message-sound-row">
                      <div><strong>{t("profile.messageSound")}</strong><small>{t("profile.messageSoundHint")}</small></div>
                      <button type="button" role="switch" aria-checked={messageSoundEnabled}
                        aria-label={t("profile.messageSound")}
                        className={"switch-button" + (messageSoundEnabled ? " on" : "")}
                        onClick={toggleMessageSound}><span /></button>
                    </div>
                    {messageSoundEnabled && (
                      <div className="settings-row message-sound-preview-row">
                        <div><strong>{t("profile.soundPreview")}</strong><small>{t("profile.soundPreviewHint")}</small></div>
                        <button type="button" className="settings-action message-sound-preview-button"
                          onClick={() => void previewMessageSound()}>
                          <Volume2 size={17} aria-hidden="true" /> {t("profile.soundPreview")}
                        </button>
                      </div>
                    )}
                  </div>
                }
                appearance={
                  <p className="settings-workspace-empty-note">
                    Giao diện SocCo hiện sử dụng bộ màu sáng thống nhất trên web và desktop.
                  </p>
                }
                storage={
                  <div className="settings-workspace-account">
                    <p className="settings-workspace-empty-note">
                      Bạn có thể quản lý ảnh, video và tệp đã chia sẻ trong từng cuộc trò chuyện.
                    </p>
                    <button type="button" className="settings-workspace-action" onClick={() => switchTab("chat")}>
                      Mở tin nhắn
                    </button>
                  </div>
                }
                devices={
                  <div className="settings-card">
                    <AccountSessionsPanel
                      sessionsBusy={sessionsBusy}
                      canManageSessions={isDesktopBuild || Boolean(session.refreshToken)}
                      sessionsOpen={sessionsOpen}
                      setSessionsOpen={setSessionsOpen}
                      fetchAccountSessions={fetchAccountSessions}
                      sessionsError={sessionsError}
                      managedSessions={managedSessions}
                      revokeAccountSessions={revokeAccountSessions}
                    />
                  </div>
                }
              />
            )}
            <input
              ref={avatarFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh đại diện"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("avatar", file);
              }}
            />
            <input
              ref={coverFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh bìa"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("cover", file);
              }}
            />

            {profileTimelineOpen && (
              <header className="personal-timeline-header">
                <button
                  type="button"
                  onClick={closeProfileTimeline}
                  aria-label="Quay lại hồ sơ"
                >
                  <ArrowLeft size={20} />
                </button>
                <h1 ref={profileHeadingRef} tabIndex={-1}>
                  Trang cá nhân
                </h1>
                <button
                  type="button"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  <Settings size={18} />
                  <span>Chỉnh sửa</span>
                </button>
              </header>
            )}
            <section className="profile-hero">
              <div
                className={`profile-cover-art ${profileMedia?.coverSet ? "has-cover" : ""}`}
              >
                <div className="profile-cover-placeholder">
                  <strong>SocCO</strong>
                  <small>Understand. Connect. Together.</small>
                </div>
                {profileMedia?.coverSet && (
                  <img
                    src={profileAssetUrl(name, "cover", profileMedia.updatedAt)}
                    alt="Ảnh bìa"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      event.currentTarget.parentElement?.classList.remove(
                        "has-cover",
                      );
                    }}
                  />
                )}
                <button
                  type="button"
                  className="profile-cover-edit"
                  disabled={
                    profileBusy !== null || mediaUploading === "profile"
                  }
                  onClick={() => coverFileInputRef.current?.click()}
                >
                  <UiIcon name="photo" size={17} />
                  {profileMedia?.coverSet ? t("profile.changeCover") : t("profile.addCover")}
                </button>
              </div>

              <div
                className="profile-identity"
                onClick={(event) => {
                  if (
                    !profileTimelineOpen &&
                    !(event.target as HTMLElement).closest("button")
                  ) {
                    setProfileTimelineOpen(true);
                    setGlobalSearch("");
                  }
                }}
              >
                <div className="profile-avatar-editor">
                  <ProfileNote
                    key={session.sessionId + ":note"}
                    username={name}
                    owner
                    request={apiFetch}
                  />
                  <UserAvatar
                    username={name}
                    name={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    className="profile-avatar"
                    online
                  />
                  <button
                    type="button"
                    className="profile-avatar-edit"
                    aria-label="Đổi ảnh đại diện"
                    title="Đổi ảnh đại diện"
                    disabled={
                      profileBusy !== null || mediaUploading === "profile"
                    }
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <UiIcon name="photo" size={17} />
                  </button>
                </div>
                <button
                  type="button"
                  ref={profileIdentityRef}
                  className="profile-identity-copy profile-identity-link"
                  aria-label="Mở trang cá nhân"
                  disabled={profileTimelineOpen}
                  onClick={() => {
                    setProfileTimelineOpen(true);
                    setGlobalSearch("");
                  }}
                >
                  <strong>
                    {profileMedia?.displayName ||
                      session.user.displayName ||
                      name}
                  </strong>
                  <span>@{name}</span>
                  <small className="profile-email">{session.user.email}</small>
                  {!profileTimelineOpen && (
                    <small className="profile-media-hint">
                      Xem trang cá nhân · Dòng thời gian ›
                    </small>
                  )}
                </button>
              </div>
            </section>

            {profileTimelineOpen ? (
              <section
                className="personal-timeline-content"
                aria-label="Dòng thời gian cá nhân"
              >
                <div className="personal-timeline-intro">
                  <div>
                    <strong>Khoảnh khắc của bạn</strong>
                    <p>Lưu giữ và chia sẻ những câu chuyện mỗi ngày.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    <PencilLine size={18} />
                    Đăng bài
                  </button>
                </div>
                <div className="profile-post-launcher">
                  <UserAvatar
                    username={name}
                    name={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    className="avatar self-avatar"
                  />
                  <button
                    type="button"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    {postText.trim()
                      ? "Tiếp tục bản nháp của bạn..."
                      : "Bạn đang nghĩ gì?"}
                  </button>
                  <button
                    type="button"
                    className="profile-post-photo"
                    aria-label="Tạo bài viết có ảnh hoặc video"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    <Images size={23} />
                  </button>
                </div>
                <div className="personal-timeline-label">
                  <h2>Dòng thời gian</h2>
                  <button
                    type="button"
                    aria-label="Tải lại dòng thời gian"
                    disabled={profilePostsBusy || !!pendingPost}
                    onClick={() => void loadProfilePosts(false, true)}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                {profilePostsError && (
                  <div className="personal-timeline-error" role="alert">
                    <p>{profilePostsError}</p>
                    <button
                      type="button"
                      disabled={profilePostsBusy}
                      onClick={() =>
                        void loadProfilePosts(profilePosts.length > 0, true)
                      }
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                <div className="feed zalo-feed">
                  {pendingPost && (
                    <article
                      className="post zalo-post outgoing-preview"
                      aria-busy="true"
                    >
                      <UserAvatar
                        username={name}
                        name={userLabel(
                          profileMedia?.displayName || session.user.displayName,
                          name,
                        )}
                        className="avatar"
                      />
                      <div className="post-body">
                        <strong>{userLabel(profileMedia?.displayName || session.user.displayName, name)}</strong>
                        <p>{pendingPost.content}</p>
                        <MediaAttachmentsView items={pendingPost.attachments} />
                      </div>
                    </article>
                  )}
                  {renderPosts(visibleProfilePosts)}
                </div>
                {!profilePostsBusy &&
                  !profilePostsError &&
                  profilePosts.length === 0 &&
                  !pendingPost && (
                    <SocoEmptyState
                      title="Chưa có bài viết nào"
                      description="Chia sẻ khoảnh khắc đầu tiên lên trang cá nhân của bạn."
                      action={
                        <SocoTextAction
                          onClick={() => setProfileComposerOpen(true)}
                        >
                          Đăng bài đầu tiên
                        </SocoTextAction>
                      }
                    />
                  )}
                {profileHasMore && (
                  <button
                    type="button"
                    className="soco-load-more soco-feed-load-more"
                    disabled={profilePostsBusy || !!pendingPost}
                    onClick={() => void loadProfilePosts(true)}
                  >
                    Xem bài viết cũ hơn
                  </button>
                )}
              </section>
            ) : (
              <>
                {isProfileDesktop && desktopProfileSettings ? (
                  <section className="profile-editor-settings-entry">
                    <div>
                      <strong>Thông tin hồ sơ</strong>
                      <p>
                        Thay đổi tên, tên người dùng, tiểu sử, thành phố và ảnh
                        hồ sơ trong trang chỉnh sửa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopProfileSettings(false);
                        setProfileEditorOpen(true);
                      }}
                    >
                      Chỉnh sửa hồ sơ
                    </button>
                  </section>
                ) : (
                  profileIdentityForm
                )}

                <div className="soco-profile-section-label">
                  TÙY CHỌN & CÀI ĐẶT
                </div>
                <section className="settings-card">
                  {profilePrivacyControls}
                  <AccountSessionsPanel
                    sessionsBusy={sessionsBusy}
                    canManageSessions={
                      isDesktopBuild || Boolean(session.refreshToken)
                    }
                    sessionsOpen={sessionsOpen}
                    setSessionsOpen={setSessionsOpen}
                    fetchAccountSessions={fetchAccountSessions}
                    sessionsError={sessionsError}
                    managedSessions={managedSessions}
                    revokeAccountSessions={revokeAccountSessions}
                  />
                  <BlockedUsersPanel
                    blockedBusy={blockedBusy}
                    blockedOpen={blockedOpen}
                    setBlockedOpen={setBlockedOpen}
                    loadBlockedUsers={loadBlockedUsers}
                    blockedError={blockedError}
                    blockedUsers={blockedUsers}
                    unblockContact={unblockContact}
                  />
                  <button
                    type="button"
                    className="settings-row settings-row-button app-locale-row"
                    onClick={() => {
                      setLocaleSearch("");
                      setLocalePickerOpen(true);
                    }}
                  >
                    <div>
                      <strong>{t("profile.appLanguage")}</strong>
                      <small>{t("profile.appLanguageHint")}</small>
                    </div>
                    <span className="settings-current-locale">
                      <b aria-hidden="true">
                        {selectedAppLanguage?.flag || "🌐"}
                      </b>
                      <span>
                        {appLocale === "auto"
                          ? t("common.auto")
                          : selectedAppLanguage?.localizedLanguage}
                        {uiLocaleLoading ? " · …" : ""}
                      </span>
                      <i aria-hidden="true">›</i>
                    </span>
                  </button>

                  <div className="settings-row">
                    <div>
                      <strong>
                        {isDesktopBuild
                          ? "Thông báo Desktop"
                          : t("profile.notifications")}
                      </strong>
                      <small>
                        {isDesktopBuild
                          ? "Ẩn nội dung và tên người gửi. Nhận khi SocCO còn chạy; thoát hẳn sẽ dừng thông báo."
                          : t("profile.notificationsHint")}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${(isDesktopBuild ? nativeNotifications.enabled : pushEnabled) ? "on" : ""}`}
                      onClick={() =>
                        isDesktopBuild
                          ? nativeNotifications.toggle()
                          : void togglePush()
                      }
                      disabled={!isDesktopBuild && pushBusy}
                      aria-label={
                        (
                          isDesktopBuild
                            ? nativeNotifications.enabled
                            : pushEnabled
                        )
                          ? "Tắt thông báo"
                          : "Bật thông báo"
                      }
                      role="switch"
                      aria-checked={
                        isDesktopBuild
                          ? nativeNotifications.enabled
                          : pushEnabled
                      }
                    >
                      <span />
                    </button>
                  </div>
                  {isDesktopBuild && nativeNotifications.warning && (
                    <div className="settings-row" role="status">
                      <small>{nativeNotifications.warning}</small>
                    </div>
                  )}
                  <div className="settings-row message-sound-row">
                    <div>
                      <strong>{t("profile.messageSound")}</strong>
                      <small>{t("profile.messageSoundHint")}</small>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${messageSoundEnabled ? "on" : ""}`}
                      onClick={toggleMessageSound}
                      aria-label={
                        messageSoundEnabled
                          ? t("profile.soundOff")
                          : t("profile.soundOn")
                      }
                      role="switch"
                      aria-checked={messageSoundEnabled}
                    >
                      <span />
                    </button>
                  </div>
                  {messageSoundEnabled && (
                    <div className="settings-row message-sound-preview-row">
                      <div>
                        <strong>{t("profile.soundPreview")}</strong>
                        <small>{t("profile.soundPreviewHint")}</small>
                      </div>
                      <button
                        type="button"
                        className="settings-action message-sound-preview-button"
                        onClick={() => void previewMessageSound()}
                        aria-label={t("profile.soundPreview")}
                      >
                        <Volume2 size={17} aria-hidden="true" />
                        {t("profile.soundPreview")}
                      </button>
                    </div>
                  )}
                  {!isDesktopBuild && (
                    <div className="settings-row">
                      <div>
                        <strong>{t("profile.testNotification")}</strong>
                        <small>{t("profile.testNotificationHint")}</small>
                      </div>
                      <button
                        type="button"
                        className="settings-action"
                        onClick={() => void sendTestPush()}
                        disabled={pushBusy || !pushEnabled}
                      >
                        {t("common.test")}
                      </button>
                    </div>
                  )}
                  <div className="settings-row">
                    <div>
                      <strong>{t("profile.autoTranslate")}</strong>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${autoTranslate ? "on" : ""}`}
                      onClick={() => changeAutoTranslate(!autoTranslate)}
                      aria-label={t("profile.autoTranslate")}
                      role="switch"
                      aria-checked={autoTranslate}
                    >
                      <span />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="settings-row settings-row-button translation-locale-row"
                    onClick={() => {
                      setTranslationSettingsSearch("");
                      setTranslationPickerOpen(true);
                    }}
                  >
                    <div>
                      <strong>{t("profile.translationLanguage")}</strong>
                      <small>{t("profile.translationLanguageHint")}</small>
                    </div>
                    <span className="settings-current-locale">
                      <b aria-hidden="true">{selectedLanguage?.flag || "🌐"}</b>
                      <span>
                        {selectedLanguage?.localizedLanguage ||
                          targetLanguage.toUpperCase()}
                      </span>
                      <i aria-hidden="true">›</i>
                    </span>
                  </button>
                  {!isStandalone && (
                    <button
                      type="button"
                      className="settings-row settings-row-button settings-install-row"
                      onClick={() => void installApp()}
                    >
                      <span className="settings-account-label">
                        <Download size={19} aria-hidden="true" />
                        {t("profile.install")}
                      </span>
                      <span
                        className="settings-account-chevron"
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="settings-row settings-row-button settings-logout-row"
                    onClick={() => logout()}
                  >
                    <span className="settings-account-label">
                      <LogOut size={19} aria-hidden="true" />
                      {t("profile.logout")}
                    </span>
                    <span
                      className="settings-account-chevron"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                </section>
              </>
            )}

            {translationPickerOpen && (
              <div
                className="locale-picker-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={t("profile.translationLanguage")}
              >
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t("common.close")}
                  onClick={() => setTranslationPickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t("profile.translationLanguage")}</strong>
                      <small>{t("translation.subtitle")}</small>
                    </div>
                    <button
                      type="button"
                      aria-label={t("common.close")}
                      onClick={() => setTranslationPickerOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={translationSettingsSearch}
                      onChange={(event) =>
                        setTranslationSettingsSearch(event.target.value)
                      }
                      placeholder={t("translation.searchPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {translationSettingsSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setTranslationSettingsSearch("")}
                      >
                        ×
                      </button>
                    )}
                  </label>

                  <div className="locale-picker-list">
                    {visibleTranslationSettingsOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${targetLanguage === language.value ? "active" : ""}`}
                        onClick={() => changeTargetLanguage(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">
                          {language.flag}
                        </span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>
                            {language.localizedRegion} · {language.nativeRegion}
                          </em>
                        </span>
                        <b>{language.code}</b>
                        {targetLanguage === language.value && (
                          <i aria-hidden="true">✓</i>
                        )}
                      </button>
                    ))}
                    {visibleTranslationSettingsOptions.length === 0 && (
                      <div className="locale-picker-empty">
                        {t("translation.noResults")}
                      </div>
                    )}
                  </div>

                  <footer>{t("translation.languageHint")}</footer>
                </section>
              </div>
            )}

            {localePickerOpen && (
              <div
                className="locale-picker-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={t("locale.title")}
              >
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t("common.close")}
                  onClick={() => setLocalePickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t("locale.title")}</strong>
                      <small>{t("locale.subtitle")}</small>
                    </div>
                    <button
                      type="button"
                      aria-label={t("common.close")}
                      onClick={() => setLocalePickerOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={localeSearch}
                      onChange={(event) => setLocaleSearch(event.target.value)}
                      placeholder={t("locale.searchPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {localeSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setLocaleSearch("")}
                      >
                        ×
                      </button>
                    )}
                  </label>

                  {!localeSearch && (
                    <button
                      type="button"
                      className={`locale-option locale-auto-option ${appLocale === "auto" ? "active" : ""}`}
                      onClick={() => void changeAppLocale("auto")}
                    >
                      <span className="locale-option-flag" aria-hidden="true">
                        ⚙️
                      </span>
                      <span className="locale-option-copy">
                        <strong>{t("locale.device")}</strong>
                        <small>{t("locale.deviceHint")}</small>
                        <em>
                          {selectedAppLanguage?.flag}{" "}
                          {selectedAppLanguage?.localizedLanguage}
                        </em>
                      </span>
                      {appLocale === "auto" && <i aria-hidden="true">✓</i>}
                    </button>
                  )}

                  <div className="locale-picker-list">
                    {visibleLocaleOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${appLocale === language.value ? "active" : ""}`}
                        onClick={() => void changeAppLocale(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">
                          {language.flag}
                        </span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>
                            {language.localizedRegion} · {language.nativeRegion}
                          </em>
                        </span>
                        <b>{language.code}</b>
                        {appLocale === language.value && (
                          <i aria-hidden="true">✓</i>
                        )}
                      </button>
                    ))}
                    {visibleLocaleOptions.length === 0 && (
                      <div className="locale-picker-empty">
                        {t("locale.noResults")}
                      </div>
                    )}
                  </div>

                  <footer>{t("locale.dynamicHint")}</footer>
                </section>
              </div>
            )}
          </div>
  );
}
