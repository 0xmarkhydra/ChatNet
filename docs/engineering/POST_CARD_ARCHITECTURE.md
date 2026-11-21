# Unified post card: Feed and Profile

## Single implementation

`frontend/src/features/feed/components/FeedPostCard.tsx` is the canonical post component for home Feed, own-profile timeline and visitor-profile timeline. Its public export remains `FeedPostCard` from `features/feed/index.ts` to avoid changing caller contracts. Do not add profile-specific copies of the card markup.

`shared/ui/card.tsx` provides only the generic card surface and supports `asChild` to render an accessible `<article>` without an extra wrapper. It must not import the feed domain or own like/comment/share behavior.

`features/feed/components/PostCardSections.tsx` owns the presentation of a post's header, engagement count and toolbar; the enclosing `FeedPostCard` continues to compose post extras, text, media and repost preview. Existing handlers, API adapter ownership, permissions and callbacks stay with feed/profile callers.

## Layout and compatibility

The header is one flex row containing the avatar, a flexible minimum-width-zero author/metadata region, and the options trigger. This avoids the old CSS Grid + `display: contents` row placement that allowed avatar and author metadata to overlap. The outer article remains a single-column layout for the full-width content, attachments and action bar. Existing feed/profile styles and class names remain for compatibility; the generic Card does not force a Feed redesign.

## QA on every update

- Feed, own Profile and visitor Profile show the same post layout, including empty captions and attachments.
- Author avatar/name/date/private visibility are readable at narrow widths; three-dot menu remains clickable.
- Like/unlike, reaction users, comment expansion, share/repost, editing and deleting preserve existing permissions and callbacks.
- Confirm loading, content navigation, keyboard focus, mobile widths and the three page scroll contexts.
- Run `npm run test:unit`, `npm run build`, `npm run lint`, `npm run check:architecture`, and review before/after browser screenshots on the preview build.
