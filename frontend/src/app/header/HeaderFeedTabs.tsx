import useSlidingPill from "../../shared/ui/useSlidingPill";
import type { FeedFilter } from "../../features/feed/utils/feedFilterRoute";

type Props = {
  filter: FeedFilter;
  onChange: (next: FeedFilter) => void;
};

const tabs = [
  { value: "all", label: "Dành cho bạn" },
  { value: "following", label: "Đang theo dõi" },
  { value: "latest", label: "Mới nhất" },
] as const;

/** Desktop filter tabs share Feed's existing filter state, not an independent copy. */
export default function HeaderFeedTabs({ filter, onChange }: Props) {
  const { hostRef, activeRef, pillRef } = useSlidingPill<HTMLDivElement>(filter);
  return (
    <div ref={hostRef} className="appbar-feed-tabs sliding-pill-host" role="tablist" aria-label="Lọc bảng tin">
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
          {item.label}
        </button>
      ))}
      {filter === "saved" && (
        <button ref={activeRef} type="button" role="tab" aria-selected={true} className="is-active">
          Đã lưu
        </button>
      )}
    </div>
  );
}
