import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsUp } from "lucide-react";
import type { Post } from "../types";
import { messageReactions } from "../../chat/utils/messageReactions";
import "../styles/feed-actions.css";

export default function FeedReactionControl({
  post,
  busy,
  react,
  showCount = false,
}: {
  post: Post;
  busy: boolean;
  react: (post: Post, emoji?: string) => Promise<void>;
  showCount?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreNextClick = useRef(false);

  function cancelHold() {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => () => cancelHold(), []);

  const selected = post.myReaction || (post.liked ? "👍" : "");
  const label =
    messageReactions.find(({ emoji }) => emoji === selected)?.label || "Thích";

  return (
    <div
      className={
        open ? "feed-reaction-control is-open" : "feed-reaction-control"
      }
      ref={host}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !busy) setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onFocus={() => {
        if (!busy) setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={
          selected ? "feed-reaction-primary liked" : "feed-reaction-primary"
        }
        disabled={busy}
        aria-label={label}
        aria-pressed={Boolean(selected)}
        aria-busy={busy}
        aria-expanded={open}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch" || busy) return;
          ignoreNextClick.current = false;
          cancelHold();
          holdTimer.current = setTimeout(() => {
            ignoreNextClick.current = true;
            setOpen(true);
          }, 450);
        }}
        onPointerUp={cancelHold}
        onPointerCancel={() => {
          cancelHold();
          ignoreNextClick.current = false;
          setOpen(false);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!busy) setOpen(true);
        }}
        onClick={() => {
          if (ignoreNextClick.current) {
            ignoreNextClick.current = false;
            return;
          }
          setOpen(false);
          void react(post, "👍");
        }}
      >
        <span className="feed-reaction-current" aria-hidden="true">
          {selected && selected !== "👍" ? (
            selected
          ) : (
            <ThumbsUp
              size={20}
              fill={selected === "👍" ? "currentColor" : "none"}
            />
          )}
        </span>
        <span>{label}</span>
        {showCount && post.likes > 0 && <b>{post.likes}</b>}
      </button>
      {open && (
        <div
          role="group"
          className="feed-reaction-picker"
          aria-label="Cảm xúc bài viết"
        >
          {messageReactions.map(({ emoji, label: reactionLabel }) => (
            <button
              type="button"
              key={emoji}
              aria-label={reactionLabel}
              className={
                "feed-reaction-option " +
                (emoji === "👍"
                  ? "reaction-like"
                  : emoji === "❤️"
                    ? "reaction-love"
                    : "reaction-face")
              }
              aria-pressed={selected === emoji}
              title={reactionLabel}
              disabled={busy}
              onClick={() => {
                setOpen(false);
                void react(post, emoji);
              }}
            >
              {emoji === "👍" ? (
                <ThumbsUp size={22} fill="currentColor" aria-hidden="true" />
              ) : emoji === "❤️" ? (
                <Heart size={22} fill="currentColor" aria-hidden="true" />
              ) : (
                <span className="feed-reaction-emoji" aria-hidden="true">
                  {emoji}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
