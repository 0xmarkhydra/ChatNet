# Agent 2 → Agent 4: public-boundary integration

The five ChatSection dependency cycles were removed by moving the structural
`ChatSectionProps` contract to `components/ChatSectionProps.ts`. The five
child components now import only this contract; `ChatSection.tsx` re-exports
the type for compatibility.

The architecture gate flags these **new type-only imports** in the contract:

- `../../contacts/types` — `FriendSearchResult`, `FriendConnection`
- `../../i18n/lib/i18n` — `UI_MESSAGES`
- `../../i18n/utils/languages` — `LanguageOption`

Agent 4 owns public `index.ts` entrypoints and the architecture baseline.
Please expose these stable contracts via the appropriate public feature entrypoint
and migrate the three imports above. Do not loosen the gate or add baseline
entries for newly introduced violations. The gate also reports unrelated
discover/profile/settings test boundary violations: those are outside Agent 2
scope.

No change is needed to runtime APIs, props, rendering, chat outbox or authentication.
