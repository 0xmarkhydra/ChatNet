# API infrastructure migration (Agent integration)

## Scope and compatibility

This branch introduces React-free `createApiTransport` and typed failure classifiers inside `shared/lib`. It intentionally does **not** modify `app/hooks/useApiRequest.ts`, `App.tsx`, other feature hooks, `features/auth/lib/session.ts`, endpoints or authentication/token contracts. Existing callers continue using the original hook unchanged until integration. No feature API directories are introduced without an actual need.

The transport preserves the existing `apiFetch(path, init) => Promise<Response>` shape, cache tags/TTL, response cloning, default 30-second signal, pending-mutation detection, cache invalidation, write deduplication key, and legacy write failure response (HTTP 503 JSON). HTTP response statuses remain returned rather than thrown. A transport/network exception on a GET now becomes an `ApiRequestError` (subclass of `Error`), retaining its message; writes still expose the legacy HTTP 503 compatibility response.

## Integration for the app agent (outside this branch's edit scope)

Inside `useApiRequest`, retain its current `useRef` values for `pendingRequests` and `mutationRequests` and the existing render-time `session` prop. Replace the function body only after running the same application-level tests:

```ts
import { createApiTransport } from '../../shared/lib/apiTransport'

const apiFetch = createApiTransport({
  session, // Snapshot from the current hook render (NOT sessionRef.current)
  getSession: () => sessionRef.current,
  client: sessionClient,
  cache: responseCache.current,
  pendingRequests: pendingRequests.current,
  mutationRequests: mutationRequests.current,
})
```

Keep the existing `return { apiFetch, pendingRequests, mutationRequests }`; do not rewrite consumer call sites. Re-creation of this plain function each hook render mirrors the old closure behavior.

## Typed errors for new feature API services

Use `httpApiError(response)` to classify non-2xx HTTP outcomes without consuming the body. Call sites that currently parse custom error response bodies must keep that behavior; do not throw a new error globally. `classifyApiError(error, isMutation)` recognizes legacy session-changed and expired messages, differentiates read network failure, and labels unconfirmed writes as `ambiguous-mutation`. `ApiRequestError.kind` is `http | network | session-expired | session-changed | ambiguous-mutation`; `status` exists for HTTP failures.

For legacy response-based write call sites, `legacyMutationFailure` retains the exact compatibility response, including the original Vietnamese message. It does **not** mean that HTTP 503 came from the server.

Do not automatically retry `ambiguous-mutation`. Request may have reached the server before the connection failed. Do not remove existing server-side idempotency mechanisms or add new request identifiers to payloads/headers without backend coordination.

## Explicit risks and follow-up checks

- The legacy mutation in-flight key is `JSON.stringify([sessionId, path, init.method, init.body])`. Two concurrent requests with equal fields share a response. It does not encode arbitrary headers or signal identity and is **not** an idempotency guarantee. This branch preserves it strictly for compatibility. Assess changes separately with product/backend owners.
- A POST can fail while its server-side effect succeeded; the 503 fallback is a deliberately ambiguous result. The caller should re-fetch authoritative state before retrying.
- Cache entries are session-scoped, but stale promises may reject when a session changes or an invalidation arrives; consumers must not overwrite newer session UI state.
- Session refresh, auth check, token and native auth behavior are still owned by `features/auth/lib/session.ts`; this branch did not change them.
- Before adoption: run `npm run build`, `npm run lint`, `npm run test:unit`, `npm run check:session`, `npm run check:cache` and exercise PWA/Desktop login, concurrent mutations, and network loss where practical.

No bulk feature call-site migrations are required.
