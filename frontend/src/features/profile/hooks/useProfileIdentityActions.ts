import type { FormEvent, RefObject } from 'react'
import type { ApiRequest, Notice } from '../../../shared/types/api'
import type { Session } from '../../../shared/types/session'
import type { ProfileMediaState, ProfileUpdateResponse } from '../types'
import { avatarRefreshVersions } from '../../../shared/ui/UserAvatar'
import { attachmentRequestBody, type MediaAttachment } from '../../../shared/utils/media'
import type { useProfileState } from './useProfileState'

type ProfileState = ReturnType<typeof useProfileState>
type Options = Pick<ProfileState,
  | 'isProfileDesktop'
  | 'profileSaving'
  | 'profileBusy'
  | 'profileDisplayNameDraft'
  | 'profileUsernameDraft'
  | 'profileBioDraft'
  | 'profileCityDraft'
  | 'profilePublicDetailsDraft'
  | 'setProfileMedia'
  | 'setProfileDisplayNameDraft'
  | 'setProfileUsernameDraft'
  | 'setProfileBioDraft'
  | 'setProfileCityDraft'
  | 'setProfilePublicDetailsDraft'
  | 'setProfileSaving'
  | 'setProfileBusy'
  | 'setProfileEditorOpen'
> & {
  session: Session | null
  sessionRef: RefObject<Session | null>
  apiFetch: ApiRequest
  saveSession: (next: Session) => void
  setNotice: Notice
  uploadMediaFiles: (files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') => Promise<MediaAttachment[]>
}

/** Profile identity/media operations and session-safe updates. No presentation ownership. */
export function useProfileIdentityActions({
  session, sessionRef, apiFetch, saveSession, setNotice, uploadMediaFiles,
  isProfileDesktop,
  profileSaving,
  profileBusy,
  profileDisplayNameDraft,
  profileUsernameDraft,
  profileBioDraft,
  profileCityDraft,
  profilePublicDetailsDraft,
  setProfileMedia,
  setProfileDisplayNameDraft,
  setProfileUsernameDraft,
  setProfileBioDraft,
  setProfileCityDraft,
  setProfilePublicDetailsDraft,
  setProfileSaving,
  setProfileBusy,
  setProfileEditorOpen,
}: Options) {
  async function loadProfileMedia() {
    if (!session?.token) return;
    const sessionId = session.sessionId;
    const response = await apiFetch("/api/profile");
    if (!response.ok) return;
    const profile = (await response.json()) as ProfileMediaState;
    if (sessionRef.current?.sessionId !== sessionId) return;
    avatarRefreshVersions.set(profile.username, profile.updatedAt);
    setProfileMedia(profile);
    setProfileDisplayNameDraft(profile.displayName);
    setProfileUsernameDraft(profile.username);
    setProfileBioDraft(profile.bio ?? "");
    setProfileCityDraft(profile.city ?? "");
    setProfilePublicDetailsDraft({ workplace: profile.workplace ?? "", school: profile.school ?? "" });
  }

  async function saveProfileIdentity(event: FormEvent) {
    event.preventDefault();
    if (!session || profileSaving) return;

    const displayName = profileDisplayNameDraft.trim();
    const username = profileUsernameDraft.trim().toLowerCase();
    const bio = profileBioDraft.trim();
    const city = profileCityDraft.trim();
    const workplace = profilePublicDetailsDraft.workplace.trim();
    const school = profilePublicDetailsDraft.school.trim();
    if (!displayName || !username) {
      setNotice("Tên hiển thị và username không được để trống.", "error");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, bio, city, workplace, school }),
      });
      const result = (await response.json().catch(() => null)) as
        | (ProfileUpdateResponse & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== session.sessionId) return;
      if (!response.ok || !result?.token) {
        throw new Error(
          result?.error || "Không cập nhật được thông tin cá nhân.",
        );
      }

      const previousUsername = session.user.username;
      avatarRefreshVersions.delete(previousUsername);
      avatarRefreshVersions.set(result.username, result.updatedAt);
      setProfileMedia({
        username: result.username,
        displayName: result.displayName,
        bio: result.bio ?? "",
        city: result.city ?? "",
        workplace: result.workplace ?? "",
        school: result.school ?? "",
        avatarSet: result.avatarSet,
        coverSet: result.coverSet,
        updatedAt: result.updatedAt,
      });
      setProfileDisplayNameDraft(result.displayName);
      setProfileUsernameDraft(result.username);
      setProfileBioDraft(result.bio ?? "");
      setProfileCityDraft(result.city ?? "");
      setProfilePublicDetailsDraft({ workplace: result.workplace ?? "", school: result.school ?? "" });

      const nextSession: Session = {
        ...sessionRef.current,
        token: result.token,
        user: {
          ...session.user,
          username: result.username,
          displayName: result.displayName,
        },
      };
      saveSession(nextSession);
      setNotice("Đã lưu thông tin hồ sơ.", "success");
      if (isProfileDesktop) setProfileEditorOpen(false);
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được thông tin cá nhân.",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId)
        setProfileSaving(false);
    }
  }

  async function updateProfileImage(kind: "avatar" | "cover", file?: File | null) {
    if (!session || profileBusy) return false;
    if (file === undefined) return false;
    if (file && !file.type.toLowerCase().startsWith("image/")) {
      setNotice("Chỉ hỗ trợ file ảnh cho ảnh đại diện và ảnh bìa.", "error");
      return false;
    }
    setProfileBusy(kind);
    try {
      const [attachment] = file ? await uploadMediaFiles([file], "profile") : [null];
      if (sessionRef.current?.sessionId !== session.sessionId) return false;
      if (file && !attachment) throw new Error("Không upload được ảnh.");

      const response = await apiFetch("/api/profile/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          attachment: attachment ? attachmentRequestBody(attachment) : null,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | (ProfileMediaState & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== session.sessionId) return false;
      if (!response.ok || !result) {
        throw new Error(result?.error || "Không cập nhật được ảnh hồ sơ.");
      }
      avatarRefreshVersions.set(result.username, result.updatedAt);
      setProfileMedia(result);
      setNotice(
        kind === "avatar"
          ? "Đã cập nhật ảnh đại diện."
          : "Đã cập nhật ảnh bìa.",
        "success",
      );
      return true;
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được ảnh hồ sơ.",
          "error",
        );
      return false;
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId)
        setProfileBusy(null);
    }
  }

  return { loadProfileMedia, saveProfileIdentity, updateProfileImage }
}