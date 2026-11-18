# ChatNet frontend routing contract

`AppRouter.tsx` selects `BrowserRouter` on web and `HashRouter` in the packaged desktop app. `RouteTree.tsx` owns the declarative authenticated route hierarchy; `FeatureRoutePages.tsx` owns the nested context-only layout and URL parameter guards; `routes.ts` owns URL helpers and top-level tab paths.

## Nested routes and shell ownership

- The signed-in shell and session/realtime providers stay mounted while navigating across supported feature routes.
- `AppLayout` owns the shared Header, Sidebar, notices and one `<Outlet context={outletContext} />`; it imports the pure `routePageContext.ts` contract, never the `PageRoute` renderer.
- `AuthedApp` remains the session-scoped feature-state controller. It supplies typed route-owned React nodes for Chat, Feed and Profile/Settings/visitors. `createSecondaryPageSlots.tsx` composes the typed React elements for Contacts/Calls, Search, Discover, Marketplace and Notifications without transferring state or mounting inactive features.
- `PageRoute` requires a `RoutePageKey` (no implicit legacy fallback), owns `modern-frame` and a page Error Boundary, and adds no new CSS or structural DOM wrappers.
- `FeatureRouteLayout` in `FeatureRoutePages.tsx` forwards the same context through nested `<Outlet />` without adding DOM or business state. The module also validates Chat conversation IDs, Feed post IDs, visitor usernames and Settings sections.
- `beforeFeed` and `afterFeed` retain the existing shared dialogs/overlays in their original DOM positions for Chat, Feed and Profile; they own no business state.
- Validated detail routes select the same page key as their parent, e.g. `/feed/posts/:postId` selects `feed` and `/users/:username` selects `profile`. Legacy `/calls/*` redirects to unified Contacts/Calls.
- Invalid child paths render `NotFoundPage` within the shell, retaining existing CSS, contextual parent links and an Error Boundary. A new route must have direct URL, unknown path and Back/Forward tests.

## Migration boundary

- Routing composition is now declarative, but business controllers and many props still live in `AuthedApp`; do not move their session/outbox/realtime/call lifecycle without separate behavioral tests.
- `LegacyHomeRedirect.tsx` preserves `/?tab=...` compatibility, search, URL fragment and navigation state.
- UI/CSS, including the approved Feed and Contacts design, is unchanged in this refactor.

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