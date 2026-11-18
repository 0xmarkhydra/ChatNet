# App-level view selectors

These modules are **pure projections** of feature state owned elsewhere.

- `appListSelectors.ts` adapts Contacts and Chat list data (nickname overlays, local/remote friend search, avatar-rail keyword matching, unread/group filters and pinned sorting).
- `feedListSelector.ts` selects Feed search/saved/following/latest results and applies the existing optimistic like preview.
- `AuthedApp` still owns the source state, session boundaries, request lifecycle and callbacks. Never move realtime, outbox, calls or authentication effects into these selectors.
- Selectors must not mutate source arrays or records. Keep the existing Vietnamese name normalization and ordering semantics until a separately approved behavior change.
- Do not modify CSS, scroll, DOM positioning or feature page design as part of selector cleanup. Tests in adjacent `*.test.ts` files protect observable selection behavior.
