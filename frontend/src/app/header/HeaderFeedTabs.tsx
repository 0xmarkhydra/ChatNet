import { useUiTranslation } from '@/shared/i18n/locale'
import useSlidingPill from "../../shared/ui/useSlidingPill";
import type { FeedFilter } from "../../features/feed/utils/feedFilterRoute";

type Props = {
  filter: FeedFilter;
  onChange: (next: FeedFilter) => void;
};

const tabs = [
  { value: "all", label: "common.ui.feedForYou" },
  { value: "following", label: "common.ui.feedFollowing" },
  { value: "latest", label: "common.newest" },
] as const;

/** Desktop filter tabs share Feed's existing filter state, not an independent copy. */
export default function HeaderFeedTabs({ filter, onChange }: Props) {
  const trUi = useUiTranslation()

  const { hostRef, activeRef, pillRef } = useSlidingPill<HTMLDivElement>(filter);
  return (
    <div ref={hostRef} className="appbar-feed-tabs sliding-pill-host" role="tablist" aria-label={trUi("feed.feedFilter")}>
      <span ref={pillRef} className="sliding-pill appbar-feed-active-pill" aria-hidden="true" />
      {tabs.map((item) => (
        <button
          ref={filter === item.value ? activeRef : undefined}
          key={item.value}
          type="button"
          role="tab"
          aria-selected={filter === item.value}
          className={filter === item.value ? "is-active" : ""}
          onClick={() => onChange(item.value)}
        >
          {trUi(item.label)}
        </button>
      ))}
      {filter === "saved" && (
        <button ref={activeRef} type="button" role="tab" aria-selected={true} className="is-active">{trUi("common.saved")}</button>
      )}
    </div>
  );
}