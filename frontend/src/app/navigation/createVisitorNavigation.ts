type VisitorNavigationDeps = {
  getOwnUsername: () => string | undefined;
  openOwnProfile: () => void;
  openVisitorProfile: (username: string, returnTo?: string) => void;
  closeVisitor: () => void;
  visitorUsername: string | null;
};

export function createVisitorNavigation({
  getOwnUsername,
  openOwnProfile,
  openVisitorProfile,
  closeVisitor,
  visitorUsername,
}: VisitorNavigationDeps) {
  function openVisitor(username: string, returnTo?: string) {
    if (username === getOwnUsername()) {
      openOwnProfile();
      return;
    }
    openVisitorProfile(username, returnTo);
  }

  function setFriendPreview(friend: { username: string } | null) {
    if (friend) openVisitor(friend.username);
    else if (visitorUsername) closeVisitor();
  }

  return { openVisitor, setFriendPreview };
}
