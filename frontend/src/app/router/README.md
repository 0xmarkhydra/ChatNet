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

## Navigation ownership after nested routes

- `useAppRouteNavigation` derives active tab, Contacts screen, Settings visibility and visitor identity from React Router, rather than storing duplicate booleans in `AuthedApp`.
- Use `setTab`, `setContactsScreen`, and `setDesktopProfileSettings` as the existing component callback contracts. Avoid calling two route setters for one click; switching to Profile from Settings requires **one** navigation.
- Use `openVisitorProfile` to open another user's profile and keep the exact return pathname, query and fragment. Use `closeVisitor` for safe internal return navigation, including when a user arrives via a direct link.
- App/business state such as profile editor visibility, active conversation and feed modal state stays in the owning feature or app state hook, not in route navigation. A route change must not remount the authenticated shell.
- Regression tests in `useAppRouteNavigation.test.tsx` cover Contacts-in-Calls behavior, Settings and Profile transitions, username encoding, visitor return URLs, and browser Back.

## Verification

Run `npm run test:unit`, `npm run lint`, `npm run check:architecture`, `npm run build` and `npm run build:desktop` from `frontend/`. Validate session/outbox/push-deeplink checks for app-shell or navigation changes. Do not claim two-device call/realtime QA from unit tests alone.
