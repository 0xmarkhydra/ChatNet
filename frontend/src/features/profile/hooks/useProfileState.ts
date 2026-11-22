import { useState, useEffect, useRef } from "react";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import { type Post } from "../../feed";
import type { ProfilePublicDetails, ProfileMediaState } from "../types";

export type UseProfileStateDeps = {
  sessionId: string | null;
};

export function useProfileState({ sessionId }: UseProfileStateDeps) {
  const [profileTimelineOpen, setProfileTimelineOpen] = useState(false);
  const [isProfileDesktop, setIsProfileDesktop] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 761px)");
    const onResize = (event: MediaQueryListEvent) =>
      setIsProfileDesktop(event.matches);
    query.addEventListener("change", onResize);
    return () => query.removeEventListener("change", onResize);
  }, []);
  const [profileComposerOpen, setProfileComposerOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [postSubmitError, setPostSubmitError] = useState("");
  // Profile timeline belongs to a login visit, even when switching A → B → A.
  const [profilePosts, setProfilePosts] = useScopedState<Post[]>(sessionId, []);
  const [profilePostsBusy, setProfilePostsBusy] = useScopedState(sessionId, false);
  const [profilePostsError, setProfilePostsError] = useScopedState(sessionId, "");
  const [profileHasMore, setProfileHasMore] = useScopedState(sessionId, false);
  const profileLoadSequence = useRef(0);
  const profilePagingBusy = useRef(false);
  const profileIdentityRef = useRef<HTMLButtonElement>(null);
  const profileHeadingRef = useRef<HTMLHeadingElement>(null);
  const [profileMedia, setProfileMedia] = useState<ProfileMediaState | null>(
    null,
  );
  const [profileBusy, setProfileBusy] = useState<"avatar" | "cover" | null>(
    null,
  );
  const [profileDisplayNameDraft, setProfileDisplayNameDraft] = useState("");
  const [profileUsernameDraft, setProfileUsernameDraft] = useState("");
  const [profileBioDraft, setProfileBioDraft] = useState("");
  const [profileCityDraft, setProfileCityDraft] = useState("");
  const [profilePublicDetailsDraft, setProfilePublicDetailsDraft] = useState<ProfilePublicDetails>({ workplace: "", school: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  return {
    isProfileDesktop,
    postSubmitError,
    profileBioDraft,
    profileBusy,
    profileCityDraft,
    profilePublicDetailsDraft,
    profileComposerOpen,
    profileDisplayNameDraft,
    profileEditorOpen,
    profileHasMore,
    profileHeadingRef,
    profileIdentityRef,
    profileLoadSequence,
    profileMedia,
    profilePagingBusy,
    profilePosts,
    profilePostsBusy,
    profilePostsError,
    profileSaving,
    profileTimelineOpen,
    profileUsernameDraft,
    setPostSubmitError,
    setProfileBioDraft,
    setProfileBusy,
    setProfileCityDraft,
    setProfilePublicDetailsDraft,
    setProfileComposerOpen,
    setProfileDisplayNameDraft,
    setProfileEditorOpen,
    setProfileHasMore,
    setProfileMedia,
    setProfilePosts,
    setProfilePostsBusy,
    setProfilePostsError,
    setProfileSaving,
    setProfileTimelineOpen,
    setProfileUsernameDraft,
  };
}