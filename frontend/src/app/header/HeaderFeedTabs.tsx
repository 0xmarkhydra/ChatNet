type FeedFilter = "all" | "following" | "latest" | "saved";

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
  return (
    <div className="appbar-feed-tabs" role="tablist" aria-label="Lọc bảng tin">
      {tabs.map((item) => (
        <button
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
        <button type="button" role="tab" aria-selected={true} className="is-active">
          Đã lưu
        </button>
      )}
    </div>
  );
}
