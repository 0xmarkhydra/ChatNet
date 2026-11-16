# ChatNet frontend routing contract

`AppRouter.tsx` selects `BrowserRouter` on web and `HashRouter` in the packaged desktop app. `RouteTree.tsx` owns the authenticated route hierarchy; `routes.ts` owns URL helpers and top-level tab paths.

## Nested routes and shell ownership

- The signed-in shell and session/realtime providers stay mounted while navigating across supported feature routes.
- The shell renders one `<Outlet context={page} />`. Each `FeatureRouteLayout` forwards that same context through its own `<Outlet />`; it intentionally adds **no DOM wrapper** and does not own business state.
- Parent index routes display the existing page for Chat, Contacts, Feed, Profile, Calls and Settings. Subroutes reuse the same page slot until feature-specific page ownership can move independently.
- Invalid child paths must render `NotFoundPage` inside the shell, with a contextual parent link. Unknown `/users` without a username is invalid.
- The route tree currently validates post IDs, conversation IDs, usernames and Settings section names before rendering. Do not replace validated routes with broad wildcard `CurrentPage` matches.

## Navigation and deep-link compatibility

- Preserve the `?post=id` legacy query while redirecting `/?tab=...`; preserve the original hash and navigation state.
- Use `feedPostPath`, `chatConversationPath`, and `visitorProfilePath` when constructing shareable links. Do not derive URLs from display names or unchecked IDs.
- Calls subroutes must not remount the live call manager. Settings subroutes must not reset session state.
- New tabs require both a `TAB_PATH` entry and an index route. The route-tree unit test checks this invariant.
- A feature may introduce its own nested layout only once it can keep the current shell/state lifecycle intact and has tests for direct URLs, invalid children, and Back/Forward.

## Verification

Run `npm run test:unit`, `npm run lint`, `npm run check:architecture`, `npm run build` and `npm run build:desktop` from `frontend/`. Validate session/outbox/push-deeplink checks for app-shell or navigation changes. Do not claim two-device call/realtime QA from unit tests alone.
