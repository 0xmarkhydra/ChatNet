import ProfileEditorPage from "./ProfileEditorPage";
import { profileAssetUrl } from "../../shared/ui/UserAvatar";
import ProfilePage from "./ProfilePage";
import ProfileNote from "./ProfileNote";
import type { UserPrivacy, ProfileMediaState } from "./types";
import type { FriendConnection } from "../contacts/types";
import { type Post } from "../feed/types";
import { FormEvent, type SetStateAction } from "react";
import { type Session } from "../auth/session";
import type { Tab } from "../../app/types";
import type { Dispatch, RefObject, ReactNode } from "react";

export type ProfileOverviewSectionProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  avatarFileInputRef: RefObject<HTMLInputElement | null>;
  changePrivacy: (key: keyof UserPrivacy) => Promise<void>;
  coverFileInputRef: RefObject<HTMLInputElement | null>;
  discardDesktopProfileEdits: () => void;
  friends: FriendConnection[];
  loadProfilePosts: (more?: boolean, force?: boolean) => Promise<void>;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  name: string;
  openVisitor: (username: string) => void;
  pendingPost: Post | null;
  privacy: UserPrivacy | null;
  privacyBusy: boolean;
  privacyError: string;
  privacyLoading: boolean;
  profileBioDraft: string;
  profileBusy: "avatar" | "cover" | null;
  profileCityDraft: string;
  profileDisplayNameDraft: string;
  profileEditorOpen: boolean;
  profileHasMore: boolean;
  profileMedia: ProfileMediaState | null;
  profilePosts: Post[];
  profilePostsBusy: boolean;
  profilePostsError: string;
  profileSaving: boolean;
  profileUsernameDraft: string;
  renderPosts: (items: Post[], showSave?: boolean) => ReactNode[];
  saveProfileIdentity: (event: FormEvent) => Promise<void>;
  session: Session;
  setActivePostId: Dispatch<SetStateAction<number | null>>;
  setPrivacyRetry: Dispatch<SetStateAction<number>>;
  setProfileBioDraft: Dispatch<SetStateAction<string>>;
  setProfileCityDraft: Dispatch<SetStateAction<string>>;
  setProfileComposerOpen: Dispatch<SetStateAction<boolean>>;
  setProfileDisplayNameDraft: Dispatch<SetStateAction<string>>;
  setProfileEditorOpen: Dispatch<SetStateAction<boolean>>;
  setProfileUsernameDraft: Dispatch<SetStateAction<string>>;
  switchTab: (nextTab: Tab) => void;
  updateProfileImage: (kind: "avatar" | "cover", file?: File) => Promise<void>;
  visibleProfilePosts: Post[];
};

export default function ProfileOverviewSection({
  apiFetch,
  avatarFileInputRef,
  changePrivacy,
  coverFileInputRef,
  discardDesktopProfileEdits,
  friends,
  loadProfilePosts,
  mediaUploading,
  name,
  openVisitor,
  pendingPost,
  privacy,
  privacyBusy,
  privacyError,
  privacyLoading,
  profileBioDraft,
  profileBusy,
  profileCityDraft,
  profileDisplayNameDraft,
  profileEditorOpen,
  profileHasMore,
  profileMedia,
  profilePosts,
  profilePostsBusy,
  profilePostsError,
  profileSaving,
  profileUsernameDraft,
  renderPosts,
  saveProfileIdentity,
  session,
  setActivePostId,
  setPrivacyRetry,
  setProfileBioDraft,
  setProfileCityDraft,
  setProfileComposerOpen,
  setProfileDisplayNameDraft,
  setProfileEditorOpen,
  setProfileUsernameDraft,
  switchTab,
  updateProfileImage,
  visibleProfilePosts,
}: ProfileOverviewSectionProps) {
  return (
      <>
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
            {profileEditorOpen ? (
              <ProfileEditorPage
                username={name}
                displayName={
                  profileMedia?.displayName || session.user.displayName || name
                }
                profile={profileMedia}
                coverUrl={
                  profileMedia?.coverSet
                    ? profileAssetUrl(name, "cover", profileMedia.updatedAt)
                    : undefined
                }
                displayNameDraft={profileDisplayNameDraft}
                setDisplayNameDraft={setProfileDisplayNameDraft}
                usernameDraft={profileUsernameDraft}
                setUsernameDraft={setProfileUsernameDraft}
                bioDraft={profileBioDraft}
                setBioDraft={setProfileBioDraft}
                cityDraft={profileCityDraft}
                setCityDraft={setProfileCityDraft}
                profileSaving={profileSaving}
                mediaBusy={profileBusy !== null || mediaUploading === "profile"}
                privacy={privacy}
                privacyBusy={privacyBusy}
                privacyLoading={privacyLoading}
                privacyError={privacyError}
                retryPrivacy={() => setPrivacyRetry((n) => n + 1)}
                changePrivacy={changePrivacy}
                onSave={saveProfileIdentity}
                onDiscard={discardDesktopProfileEdits}
                onChangeAvatar={() => avatarFileInputRef.current?.click()}
                onChangeCover={() => coverFileInputRef.current?.click()}
              />
            ) : (
              <ProfilePage
                username={name}
                displayName={
                  profileMedia?.displayName || session.user.displayName || name
                }
                email={session.user.email}
                bio={profileMedia?.bio}
                city={profileMedia?.city}
                coverUrl={
                  profileMedia?.coverSet
                    ? profileAssetUrl(name, "cover", profileMedia.updatedAt)
                    : undefined
                }
                coverSet={Boolean(profileMedia?.coverSet)}
                editBusy={profileBusy !== null || mediaUploading === "profile"}
                friends={friends}
                posts={profilePosts}
                pendingPost={pendingPost}
                postsBusy={profilePostsBusy}
                postsError={profilePostsError}
                hasMorePosts={profileHasMore}
                postCards={renderPosts(visibleProfilePosts)}
                profileNote={
                  <ProfileNote
                    key={session.sessionId + ":desktop-note"}
                    username={name}
                    owner
                    request={apiFetch}
                  />
                }
                onEditProfile={() => setProfileEditorOpen(true)}
                onChangeAvatar={() => avatarFileInputRef.current?.click()}
                onChangeCover={() => coverFileInputRef.current?.click()}
                onCreatePost={() => setProfileComposerOpen(true)}
                onReloadPosts={() => void loadProfilePosts(false, true)}
                onLoadMorePosts={() => void loadProfilePosts(true)}
                onViewFriend={openVisitor}
                onOpenContacts={() => switchTab("contacts")}
                onOpenPost={setActivePostId}
              />
            )}
          </>
  );
}
