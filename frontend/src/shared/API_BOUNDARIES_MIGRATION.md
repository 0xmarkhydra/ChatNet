# Agent 07 — API/public-boundary migration guide

Baseline: `origin/main` at `ab54502`. No `frontend/src/features/*/api/` or `frontend/src/features/*/index.ts` modules exist on this revision. Do not create speculative barrels or move hooks/components owned by Agents 01–04.

## Existing boundaries

- `features/auth/lib/session.ts` owns the authentication client and token/session contract.
- `shared/lib/apiTransport.ts` implements a React-independent transport wrapper with the existing `apiFetch` response contract. `app/hooks/useApiRequest.ts` is its React integration; coordinate any modifications there with Agent 01/07.
- `shared/lib/apiErrors.ts` exports `ApiRequestError`, `classifyApiError`, `httpApiError`, and `legacyMutationFailure`. Distinct kinds already exist for HTTP, network, session expiration/change, and ambiguous mutation. Keep legacy response mapping unchanged until consumers are migrated.
- `shared/lib/sessionCache.ts` owns session-scoped GET caching/deduplication, invalidation tags, and now `SessionCacheInvalidatedError` for a discarded in-flight response. The Vietnamese message is unchanged.

## Integration steps

1. Keep the existing `SessionResponseCache` and `mutationTags` imports stable. Callers may optionally detect `SessionCacheInvalidatedError` and classify it separately from network failures; do not change error presentation without parity checks.
2. Preserve the `ApiRequestError` kinds and `legacyMutationFailure` contract. A synthesized 503 after an unconfirmed write is not equivalent to a server-confirmed 503 and must never trigger automatic write retries.
3. Keep GETs carrying a caller `RequestInit.signal` outside shared request deduplication: one caller's abort must not cancel unrelated consumers. Preserve the 30-second transport timeout where no signal is supplied.
4. Maintain cache scope by user/session, clear or invalidate on session/relationship/privacy changes, and preserve uncached privacy/message reads.
5. Create `features/<feature>/api/` and per-feature `index.ts` only alongside verified imports and migrated call sites. Prefer explicit public exports, not `export *` barrels exposing internal hooks or auth implementation.

## Verification commands (from worktree root)

- `node frontend/scripts/session-cache-check.mjs` (existing cache integration contract)
- `npm --prefix frontend run test:unit` (including `shared/lib/sessionCache.test.ts`)
- `npm --prefix frontend run lint` and `npm --prefix frontend run build`

## Agent 07 coordination / risks

- Write deduplication in `apiTransport.ts` keys by session ID, path, method, body. It deliberately preserves legacy behavior; inspect whether different request headers/intents can collide *before* changing the key. This key is not a server idempotency guarantee.
- `legacyMutationFailure` intentionally returns a 503 JSON Response for ambiguous writes to preserve current UI callers. Carry typed classification through a deliberate coordinated migration rather than silently rewriting all call sites.
- Existing error handling tests live in `shared/lib/apiTransport.test.ts`. Expand only for concrete missing cases, including session change while requests are in flight.
- Manual two-session/realtime and ambiguous-write recovery QA are outside this Agent 05 automated verification.
