import { useState, useEffect, useRef } from "react";
import { type Post } from "../../feed/types";
import type { ProfileMediaState } from "../types";

export type UseProfileStateDeps = {

};

export function useProfileState({

}: UseProfileStateDeps) {  const [profileTimelineOpen, setProfileTimelineOpen] = useState(false);
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
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profilePostsBusy, setProfilePostsBusy] = useState(false);
  const [profilePostsError, setProfilePostsError] = useState("");
  const [profileHasMore, setProfileHasMore] = useState(false);
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
  const [profileSaving, setProfileSaving] = useState(false);

  return {
    isProfileDesktop,
    postSubmitError,
    profileBioDraft,
    profileBusy,
    profileCityDraft,
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
