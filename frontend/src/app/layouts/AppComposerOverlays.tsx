import type { ComponentProps } from "react";
import type { Tab } from "../../shared/types/navigation";
import FeedComposerOverlay from "../../features/feed/components/FeedComposerOverlay";
import ProfileComposerOverlay from "../../features/profile/components/ProfileComposerOverlay";

type SharedComposerProps = Omit<
  ComponentProps<typeof FeedComposerOverlay>,
  "setFeedComposerOpen"
>;

type AppComposerOverlaysProps = SharedComposerProps & {
  tab: Tab;
  feedComposerOpen: boolean;
  profileComposerOpen: boolean;
  profileTimelineOpen: boolean;
  desktopProfileOverview: boolean;
  setFeedComposerOpen: ComponentProps<typeof FeedComposerOverlay>["setFeedComposerOpen"];
  setProfileComposerOpen: ComponentProps<typeof ProfileComposerOverlay>["setProfileComposerOpen"];
};

export default function AppComposerOverlays({
  tab,
  feedComposerOpen,
  profileComposerOpen,
  profileTimelineOpen,
  desktopProfileOverview,
  setFeedComposerOpen,
  setProfileComposerOpen,
  ...shared
}: AppComposerOverlaysProps) {
  return (
    <>
      {feedComposerOpen && tab === "feed" && (
        <FeedComposerOverlay {...shared} setFeedComposerOpen={setFeedComposerOpen} />
      )}
      {profileComposerOpen &&
        tab === "profile" &&
        (profileTimelineOpen || desktopProfileOverview) && (
          <ProfileComposerOverlay {...shared} setProfileComposerOpen={setProfileComposerOpen} />
        )}
    </>
  );
}
