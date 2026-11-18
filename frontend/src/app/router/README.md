# ChatNet frontend routing contract

`AppRouter.tsx` selects `BrowserRouter` on web and `HashRouter` in the packaged desktop app. `RouteTree.tsx` owns the authenticated route hierarchy; `routes.ts` owns URL helpers and top-level tab paths.

## Nested routes and shell ownership

- The signed-in shell and session/realtime providers stay mounted while navigating across supported feature routes.
- `AppLayout` renders the shared Header, Sidebar, notices and a single direct `<Outlet context={outletContext} />`. `PageRoute` owns `modern-frame` and page-specific Error Boundary without adding new CSS or structural DOM wrappers.
- `AuthedApp` remains the session-scoped feature-state controller. It supplies `AppPageContext` with route-owned React nodes for Chat, Feed, Profile/Settings/visitors, Contacts/Calls, Search, Discover, Marketplace, and Notifications. Every `PageRoute` requires a typed `page` key selected by the URL.
- `FeatureRouteLayout` forwards that same context through its nested `<Outlet />` and intentionally adds **no DOM wrapper** or business state. The `beforeFeed` and `afterFeed` slots retain existing shared dialogs and overlays in their original DOM order for Chat, Feed and Profile; they do not own feature business state.
- Parent and validated detail routes select the same feature page key (e.g. `/feed` and `/feed/posts/:postId` both select `feed`; `/settings` and `/users/:username` select `profile`). Legacy `/calls/*` redirects to the unified Contacts/Calls workspace.
- Invalid child paths render standalone `NotFoundPage` inside the shell, with its existing CSS structure, contextual parent link, and page Error Boundary. Unknown `/users` without a username is invalid.
- `FeatureRouteGuards.tsx` owns nested context forwarding and validation for Chat conversation IDs, Feed post IDs, visitor usernames and Settings sections. `RouteTree.tsx` stays declarative; keep invalid paths directed to `NotFoundPage` rather than broad wildcard matches.
- Navigation regressions must cover invalid nested routes followed by Back/Forward without remounting the app shell.

## Migration boundary

- Routing composition is now declarative, but many props and business controllers are still built in `AuthedApp`. Moving them into feature hooks/controllers must happen separately with session/outbox/realtime/call lifecycle coverage.
- `LegacyHomeRedirect.tsx` preserves the `/?tab=...` compatibility entry point, search, hash and navigation state.
- `FeatureRouteGuards.tsx` owns nested URL validation, not feature state.
- Route content for Chat, Feed and Profile deliberately retains shared overlays in their previous relative order; test this before changing their ownership. UI/CSS (including Feed and Contacts) must stay unchanged in this refactor.

## Navigation and deep-link compatibility

- Preserve the `?post=id` legacy query while redirecting `/?tab=...`; preserve the original hash and navigation state.
- Use `feedPostPath`, `chatConversationPath`, and `visitorProfilePath` when constructing shareable links. Do not derive URLs from display names or unchecked IDs.
- Calls legacy subroutes redirect to the unified Contacts/Calls workspace without remounting the live call manager. Settings subroutes must not reset session state.
- New tabs require both a `TAB_PATH` entry and an index route. The route-tree unit test checks this invariant.
- A feature may introduce its own nested layout only once it can keep the current shell/state lifecycle intact and has tests for direct URLs, invalid children, and Back/Forward.

## Navigation ownership after nested routes

- `useAppRouteNavigation` derives active tab, Contacts screen, Settings visibility and visitor identity from React Router, rather than storing duplicate booleans in `AuthedApp`.
- Use `setTab`, `setContactsScreen`, and `setDesktopProfileSettings` as the existing component callback contracts. Avoid calling two route setters for one click; switching to Profile from Settings requires **one** navigation.
- Use `openVisitorProfile` to open another user's profile and keep the exact return pathname, query and fragment. Use `closeVisitor` for safe internal return navigation, including when a user arrives via a direct link.
- App/business state such as profile editor visibility, active conversation and feed modal state stays in the owning feature or app state hook, not in route navigation. A route change must not remount the authenticated shell.
- Regression tests in `useAppRouteNavigation.test.tsx` cover Contacts-in-Calls behavior, Settings and Profile transitions, username encoding, visitor return URLs, and browser Back.

## Visual and ownership constraints

- Keep Feed, Contacts and all existing features' CSS byte-for-byte aligned with current `origin/main` in shell-only PRs. No added hover offsets, global padding, max-width or Tailwind migration.
- App Shell owns page placement; features may keep their existing internal grids until each is migrated and QA-approved.
- Every route-owned page addition needs a Router test for direct URL, unknown path, Back/Forward, and persistent shell. Preserve post, chat, session, outbox and active call behavior.
- Refactor worktrees must be updated from `origin/main` before the integration PR; avoid editing a teammate's main checkout.

## Verification

Run `npm run test:unit`, `npm run lint`, `npm run check:architecture`, `npm run build` and `npm run build:desktop` from `frontend/`. Validate session/outbox/push-deeplink checks for app-shell or navigation changes. Do not claim two-device call/realtime QA from unit tests alone.