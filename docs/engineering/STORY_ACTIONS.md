# Private Story likes and profile highlights (SOCCO-88 and SOCCO-90)

- A viewer can like or unlike an active Story in the viewer. The action is
  separate from replying and does not send a direct message. Other viewers only
  receive their own liked state. Only the author can see the list of likers.
- An author can choose **Thêm vào Tin nổi bật** from an active Story's menu.
  Each highlight has a title and uses the original Story as its cover. The
  profile shows the highlights. The author can rename or remove them there.
- Ordinary Stories expire after 24 hours. A highlight remains on the profile,
  outside the regular Story feed, until the author removes it or deletes the
  original Story. Highlights carry over the original visibility and block rules.
- This Web/PWA release does not archive unselected expired Stories, modify native
  mobile apps, or let the author upload an independent cover.

Backend integration tests use a disposable PostgreSQL database. They exercise
idempotent likes, privacy across three users, ownership, expiry, blocking,
and removal and deletion of pinned stories.
