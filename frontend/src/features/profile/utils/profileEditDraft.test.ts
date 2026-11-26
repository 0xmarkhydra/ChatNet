import { expect, it } from "vitest";
import { profileEditDraft } from "./profileEditDraft";

it("restores persisted profile data rather than unsaved form input", () => {
  expect(profileEditDraft({
    username: "persisted", displayName: "Persisted name", bio: "Bio",
    city: "Da Nang", workplace: "Team", school: "School",
    avatarSet: true, coverSet: false, updatedAt: "",
  }, "session", "Session name")).toEqual({
    username: "persisted", displayName: "Persisted name", bio: "Bio",
    city: "Da Nang", publicDetails: { workplace: "Team", school: "School" },
  });
});

it("uses the current session identity when the profile is missing", () => {
  expect(profileEditDraft(null, "current", "Visible name")).toEqual({
    username: "current", displayName: "Visible name", bio: "",
    city: "", publicDetails: { workplace: "", school: "" },
  });
});
