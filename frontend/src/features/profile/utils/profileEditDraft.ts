import type { ProfileMediaState, ProfilePublicDetails } from "../types";

export type ProfileEditDraft = {
  displayName: string;
  username: string;
  bio: string;
  city: string;
  publicDetails: ProfilePublicDetails;
};

/** Restore the canonical profile after abandoning an in-progress edit. */
export function profileEditDraft(
  media: ProfileMediaState | null,
  username: string,
  sessionDisplayName: string,
): ProfileEditDraft {
  return {
    displayName: media?.displayName ?? sessionDisplayName ?? username,
    username: media?.username ?? username,
    bio: media?.bio ?? "",
    city: media?.city ?? "",
    publicDetails: {
      workplace: media?.workplace ?? "",
      school: media?.school ?? "",
    },
  };
}
