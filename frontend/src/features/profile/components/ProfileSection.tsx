import { Link } from "react-router-dom";
import { StoryHighlights } from '../../feed'
import { SettingsWorkspace } from "../../settings";
import { PencilLine, Download, LogOut, ChevronDown, ChevronRight, Volume2, ArrowLeft, Settings, Images, RefreshCw, Camera, Plus, Ellipsis, Menu, Search } from "lucide-react";
import { BlockedUsersPanel, type FriendConnection } from "../../contacts";
import PostComposerLauncher from "@/shared/ui/PostComposerLauncher";
import ProfileFriendsPreview from "./ProfileFriendsPreview";
import { isDesktopBuild } from "../../../platform/desktop";
import { AccountSessionsPanel } from "../../auth";
import UserAvatar, { avatarTone, profileAssetUrl } from "../../../shared/ui/UserAvatar";
import { Button } from "@/shared/ui/button";
import { CoverHeader, CoverHeaderAction, COVER_HEADER_OFFSET } from "@/shared/ui/CoverHeader";
import UiIcon from "../../../shared/ui/UiIcon";
import ProfileNote from "./ProfileNote";
import ProfileAvatarMenu from "./ProfileAvatarMenu";
import ProfileAvatarPicker from "./ProfileAvatarPicker";
import ProfileHero from "./ProfileHero";
import { MobileProfileMenu, MobileProfilePrivacy, MobileProfileScreen, isMobileProfileEdit, type MobileProfileSettingsView } from "./MobileProfileSettings";
import MobileProfileEditor, { confirmMobileProfileExit, mobileProfileDirty, type MobileProfileEditorProps } from "./MobileProfileEditor";
import ProfileDetailsCard from "./ProfileDetailsCard";
import ProfileMediaGallery from "./ProfileMediaGallery";
import { userLabel } from "../../../shared/utils/userLabel";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import type { ManagedAccountSession } from "../../auth";
import { type Post } from "../../feed";
import type { UserPrivacy, ProfileMediaState } from "../types";
import { type Session } from "../../../shared/types/session";
import { useState, type SetStateAction } from "react";
import type { Tab } from "../../../shared/types/navigation";
import { UI_MESSAGES } from "../../i18n";
import type { LanguageOption } from "../../i18n";
import type { Dispatch, RefObject, ReactNode, CSSProperties } from "react";

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
  onCreateStory: () => void;
  onOpenPost: (postId: number) => void;
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
  friendCount: number;
  friends: FriendConnection[];
  onViewFriend: (username: string) => void;
  onCreateMediaPost: (files: File[]) => void;
  onCheckIn: () => void;
  storyBusy?: boolean;
  profileIdentityForm: ReactNode;
  mobileEditor: Omit<MobileProfileEditorProps, "onChangeAvatar" | "onChangeCover">;
  settingsView: MobileProfileSettingsView;
  setSettingsView: (view: MobileProfileSettingsView) => void;
  onProfileQr: () => void;
  onSavedPosts: () => void;
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
  updateProfileImage: (kind: "avatar" | "cover", file?: File | null) => Promise<boolean>;
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
  onCreateStory,
  onOpenPost,
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
  friendCount,
  friends,
  onViewFriend,
  onCreateMediaPost,
  onCheckIn,
  storyBusy = false,
  profileIdentityForm,
  mobileEditor,
  settingsView,
  setSettingsView,
  onProfileQr,
  onSavedPosts,
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
  const [avatarPicker, setAvatarPicker] = useState<{ opener: HTMLButtonElement | null } | null>(null);
  const openAvatarPicker = (opener: HTMLButtonElement | null) => setAvatarPicker({ opener });
  const displayName = userLabel(profileMedia?.displayName || session.user.displayName, name);
  const [timelineView, setTimelineView] = useState<"all" | "image" | "video">("all");
  const mobileTimeline = profileTimelineOpen && !isProfileDesktop;
  const mediaSelected = mobileTimeline && timelineView !== "all";
  const activeSettings = mobileTimeline ? settingsView : null;
  const editingProfile = isMobileProfileEdit(activeSettings);
  const openEdit = (fromMenu: boolean) => setSettingsView(fromMenu ? "edit-from-menu" : "edit");
  const backSettings = () => {
    if (editingProfile) {
      if (mobileEditor.saving || !confirmMobileProfileExit(mobileProfileDirty(mobileEditor))) return;
      mobileEditor.onDiscard();
      setSettingsView(activeSettings === "edit-from-menu" ? "menu" : null);
    } else setSettingsView(activeSettings === "menu" ? null : "menu");
  };
  const coverLabel = profileMedia?.coverSet ? t("profile.changeCover") : t("profile.addCover");
  return (
      <div
            className={`simple-view profile-view ${profileTimelineOpen ? "personal-timeline-view" : ""} ${mobileTimeline ? `${activeSettings ? "" : "bg-card!"} px-0! pt-0! font-[family-name:var(--soco-font-sans)] text-foreground` : ""} ${isProfileDesktop && desktopProfileSettings ? "settings-workspace-open" : ""}`}
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
            {avatarPicker && (
              <ProfileAvatarPicker
                key={session.sessionId}
                username={name}
                avatarUrl={profileMedia?.avatarSet ? profileAssetUrl(name, 'avatar', profileMedia.updatedAt) : undefined}
                posts={profilePosts}
                busy={profileBusy !== null || mediaUploading === 'profile'}
                opener={avatarPicker.opener}
                inputRef={avatarFileInputRef}
                onSave={file => updateProfileImage('avatar', file)}
                onClose={() => setAvatarPicker(null)}
              />
            )}
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

            {profileTimelineOpen && !mobileTimeline && (
              <header className="personal-timeline-header profile-page-toolbar">
                <button
                  type="button"
                  onClick={closeProfileTimeline}
                  aria-label="Quay lại hồ sơ"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 ref={profileHeadingRef} tabIndex={-1}>
                  Trang cá nhân
                </h2>
                {mobileTimeline ? <button
                  type="button"
                  onClick={closeProfileTimeline}
                  aria-label="Cài đặt"
                >
                  <Settings size={18} aria-hidden="true" />
                </button> : <button
                  type="button"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  <Settings size={18} />
                  <span>Chỉnh sửa</span>
                </button>}
              </header>
            )}
            {activeSettings ? (
              <MobileProfileScreen title={activeSettings === "menu" ? "Cài đặt trang cá nhân" : editingProfile ? "Chỉnh sửa trang cá nhân" : activeSettings === "privacy" ? "Quyền hiển thị" : "Người dùng đã chặn"} onBack={backSettings} backDisabled={editingProfile && mobileEditor.saving}>
                {activeSettings === "menu" && <MobileProfileMenu username={name} displayName={displayName} friendCount={friendCount} onEdit={() => openEdit(true)} onQr={onProfileQr} onPrivacy={() => setSettingsView("privacy")} onBlocked={() => { setSettingsView("blocked"); void loadBlockedUsers(); }} onSaved={() => { setSettingsView(null); onSavedPosts(); }} />}
                {editingProfile && <MobileProfileEditor {...mobileEditor} onChangeAvatar={openAvatarPicker} onChangeCover={() => coverFileInputRef.current?.click()} />}
                {activeSettings === "privacy" && <MobileProfilePrivacy privacy={privacy} loading={privacyLoading} busy={privacyBusy} error={privacyError} onRetry={() => setPrivacyRetry(value => value + 1)} onSave={savePrivacy} />}
                {activeSettings === "blocked" && <section className="rounded-ui-lg bg-card p-ui-3"><BlockedUsersPanel blockedBusy={blockedBusy} blockedOpen={blockedOpen} setBlockedOpen={setBlockedOpen} loadBlockedUsers={loadBlockedUsers} blockedError={blockedError} blockedUsers={blockedUsers} unblockContact={unblockContact} />{blockedBusy && <p role="status">Đang tải…</p>}</section>}
              </MobileProfileScreen>
            ) : <>
            {mobileTimeline && (
                <CoverHeader label="Điều hướng trang cá nhân"
                  leading={<CoverHeaderAction label="Menu tài khoản" onClick={closeProfileTimeline}><Menu size={24} aria-hidden="true" /></CoverHeaderAction>}
                >
                  <CoverHeaderAction label="Chỉnh sửa trang cá nhân" onClick={() => openEdit(false)}><PencilLine size={24} aria-hidden="true" /></CoverHeaderAction>
                  <CoverHeaderAction label="Tìm kiếm" asChild><Link to="/search"><Search size={24} aria-hidden="true" /></Link></CoverHeaderAction>
                  <CoverHeaderAction label="Cài đặt trang cá nhân" onClick={() => setSettingsView("menu")}><Ellipsis size={25} className="rounded-full border-2 border-current p-0.5" aria-hidden="true" /></CoverHeaderAction>
                </CoverHeader>
            )}
            <ProfileHero username={name}
              compact={!profileTimelineOpen && !isProfileDesktop}
              centered={mobileTimeline}
              bio={mobileTimeline ? profileMedia?.bio : undefined}
              headingRef={mobileTimeline ? profileHeadingRef : undefined}
              displayName={displayName}
              city={profileMedia?.city} workplace={profileMedia?.workplace} school={profileMedia?.school}
              friendCount={friendCount}
              coverUrl={profileMedia?.coverSet ? profileAssetUrl(name, "cover", profileMedia.updatedAt) : undefined}
              fallbackCoverTone={isProfileDesktop ? undefined : avatarTone(displayName)}
              coverAction={<><button type="button" className={mobileTimeline ? "absolute right-4 bottom-9 z-20 grid size-control-touch place-items-center rounded-ui-md border-0 bg-black/60 text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" : "profile-page-cover-action"}
                aria-label={coverLabel} title={coverLabel}
                disabled={profileBusy !== null || mediaUploading === "profile"}
                onClick={() => coverFileInputRef.current?.click()}>
                {mobileTimeline ? <Camera size={19} aria-hidden="true" /> : <><UiIcon name="photo" size={17} />{coverLabel}</>}
              </button></>}
              note={<ProfileNote key={session.sessionId + ":profile-note"} username={name} displayName={displayName} owner request={apiFetch} />}
              avatar={<ProfileAvatarMenu username={name} displayName={displayName}
                  avatarClassName={mobileTimeline ? "size-full rounded-full text-5xl font-bold [&>.presence-dot]:right-auto! [&>.presence-dot]:left-2!" : "profile-page-avatar"} cameraBadge={mobileTimeline} avatarSet={Boolean(profileMedia?.avatarSet)}
                  avatarVersion={profileMedia?.updatedAt} editBusy={profileBusy !== null || mediaUploading === "profile"}
                  onChangeAvatar={openAvatarPicker} />}
              actions={mobileTimeline ? (
                <>
                  <Button size="lg" className="min-h-control-touch min-w-0 gap-ui-1 whitespace-normal rounded-ui-md! px-ui-2 text-[14px]! font-bold! text-white! bg-primary!" onClick={onCreateStory}>
                    <Plus size={17} aria-hidden="true" />Tạo tin
                  </Button>
                  <Button size="lg" variant="secondary" className="min-h-control-touch min-w-0 gap-ui-1 whitespace-normal rounded-ui-md! px-ui-2 text-[14px]! font-bold! text-foreground! bg-secondary!" onClick={() => openEdit(false)}>
                    <PencilLine size={17} aria-hidden="true" />Chỉnh sửa hồ sơ
                  </Button>
                </>
              ) : !profileTimelineOpen && (
                <>
                  <small className="profile-page-overview-email text-ui-label text-muted-foreground" title={session.user.email}>
                    {session.user.email}
                  </small>
                  <Button ref={profileIdentityRef} variant="ghost" size="lg" className="gap-1 px-2 text-primary"
                    aria-label="Mở trang cá nhân" onClick={() => {
                      setTimelineView("all");
                      setProfileTimelineOpen(true);
                      setGlobalSearch("");
                    }}>
                    Xem trang cá nhân <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </>
              )} />

            {mobileTimeline && (
              <div className="sticky top-[var(--cover-header-offset)] z-20 flex w-full shrink-0 flex-wrap gap-ui-2 bg-card px-ui-4 py-ui-2 box-border" style={{ "--cover-header-offset": COVER_HEADER_OFFSET } as CSSProperties} role="group" aria-label="Nội dung trang cá nhân">
                <Button size="lg" variant={timelineView === "all" ? "secondary" : "ghost"}
                  className="min-h-control-touch rounded-full! text-[14px]! font-semibold! text-foreground! aria-pressed:bg-[#e2ecff]! aria-pressed:font-bold! aria-pressed:text-primary!"
                  aria-pressed={timelineView === "all"} onClick={() => setTimelineView("all")}>Bài viết</Button>
                {(["image", "video"] as const).map(kind => (
                  <Button key={kind} size="lg" variant={timelineView === kind ? "secondary" : "ghost"}
                    className="min-h-control-touch rounded-full! text-[14px]! font-semibold! text-foreground! aria-pressed:bg-primary/10! aria-pressed:text-primary!"
                    aria-pressed={timelineView === kind} onClick={() => setTimelineView(kind)}>{kind === "image" ? "Ảnh" : "Video"}</Button>
                ))}
                <Button variant="ghost" size="icon" className="ml-auto size-control-touch rounded-full! text-muted-foreground!" aria-label="Cài đặt" onClick={closeProfileTimeline}><Settings size={20} aria-hidden="true" /></Button>
              </div>
            )}

            {mediaSelected ? (
              <section className="personal-timeline-content profile-mobile-media w-full! px-ui-4!" aria-label={timelineView === "image" ? "Ảnh" : "Video"}>
                {profilePostsError && <p role="alert">{profilePostsError}{" "}
                  <Button variant="outline" onClick={() => void loadProfilePosts(false, true)}>Thử lại</Button></p>}
                <ProfileMediaGallery
                  items={profilePosts.flatMap(post => (post.attachments ?? []).flatMap((attachment, index) =>
                    attachment.kind === timelineView && attachment.url ? [{ postId: post.id, attachment, index }] : [],
                  ))}
                  emptyText={timelineView === "image" ? "Chưa có ảnh trong các bài viết đã tải." : "Chưa có video trong các bài viết đã tải."}
                  postsBusy={profilePostsBusy} onOpenPost={onOpenPost} onCreatePost={() => setProfileComposerOpen(true)} />
                {profileHasMore && <Button variant="outline" disabled={profilePostsBusy}
                  onClick={() => void loadProfilePosts(true)}>Xem thêm từ bài viết cũ</Button>}
              </section>
            ) : profileTimelineOpen ? (
              <section
                className={mobileTimeline ? "personal-timeline-content w-full! max-w-none! px-ui-4! pt-ui-3!" : "personal-timeline-content"}
                aria-label="Dòng thời gian cá nhân"
              >
                <div className={mobileTimeline ? "grid min-w-0 gap-ui-6 pb-ui-4" : "profile-page-aside"}>
                  <ProfileDetailsCard username={name} bio={mobileTimeline ? undefined : profileMedia?.bio} city={profileMedia?.city}
                    workplace={profileMedia?.workplace} school={profileMedia?.school} iconEdit={mobileTimeline}
                    hasPrivateEmail={Boolean(session.user.email)} onEdit={() => mobileTimeline ? openEdit(false) : setProfileEditorOpen(true)} />
                  {mobileTimeline && <ProfileFriendsPreview friends={friends} onViewFriend={onViewFriend} onViewAll={() => switchTab("contacts")} />}
                  <StoryHighlights key={session.sessionId + ":" + name} request={apiFetch} username={name} className={mobileTimeline ? undefined : "profile-page-about"} owner mobileProfile={mobileTimeline} />
                </div>
                {mobileTimeline ? (
                  <div className="-mx-4! w-[calc(100%+32px)]! max-w-none! min-w-0">
                  <PostComposerLauncher flushOnMobile username={name} displayName={displayName}
                    prompt={postText.trim() ? "Tiếp tục bài viết của bạn..." : "Bạn đang nghĩ gì?"}
                    onCreatePost={() => setProfileComposerOpen(true)} onCreateMediaPost={onCreateMediaPost}
                    onCreateStory={onCreateStory} onCheckIn={onCheckIn} pending={!!pendingPost || mediaUploading === "feed"} storyBusy={storyBusy} />
                  </div>
                ) : (
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
                )}
                {!mobileTimeline && (
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
                )}
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

                <div className={mobileTimeline ? "feed zalo-feed -mx-4! w-[calc(100%+32px)]! border-t-8 border-solid border-background border-x-0 border-b-0" : "feed zalo-feed app-mobile:-mx-3! app-mobile:w-[calc(100%+24px)]!"}>
                  {pendingPost && (
                    <article
                      className="outgoing-preview mb-3.5 grid grid-cols-[42px_minmax(0,1fr)] gap-2.5 overflow-hidden rounded-ui-xl border border-border bg-card px-3 pt-3.5 pb-3 text-foreground shadow-[0_4px_22px_rgba(38,61,120,0.043)]"
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
                      <strong className="min-w-0 text-ui-body font-bold text-foreground">{userLabel(profileMedia?.displayName || session.user.displayName, name)}</strong>
                      <p className="col-span-full mt-2.5 mb-1.5 text-ui-body leading-normal whitespace-pre-wrap">{pendingPost.content}</p>
                      <MediaAttachmentsView items={pendingPost.attachments} />
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
                          {language.nativeLanguage !== language.localizedLanguage && (
                            <small>{language.nativeLanguage}</small>
                          )}
                          <em>
                            {language.localizedRegion}
                            {language.nativeRegion !== language.localizedRegion && ` · ${language.nativeRegion}`}
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
            </>}
          </div>
  );
}