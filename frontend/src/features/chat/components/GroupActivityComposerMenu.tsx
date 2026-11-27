import { useUiTranslation } from '@/shared/i18n/locale'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, ClipboardList, FileText, MoreHorizontal } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { GroupActivityKind } from '../types/groupActivities'

const labels: Record<GroupActivityKind, string> = {
  poll: 'Bình chọn', note: 'Ghi chú', reminder: 'Nhắc hẹn',
}
const icons = { poll: ClipboardList, note: FileText, reminder: CalendarClock }

export function GroupActivityComposerMenu({
  onCreate,
}: {
  onCreate: (kind: GroupActivityKind) => void;
}) {
  const trUi = useUiTranslation()

  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPosition(null), []);
  useEffect(() => {
    if (!position) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [position, close]);

  return (
    <>
      <button
        ref={triggerRef}
        className="ghost-action group-activity-composer-trigger"
        type="button"
        aria-label={trUi("common.ui.groupTools")}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        title={trUi("common.ui.groupOptions")}
        onClick={() => {
          if (position) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPosition({
            left: Math.min(Math.max(8, rect.left), window.innerWidth - 224),
            top: rect.top < 190 ? rect.bottom + 8 : rect.top - 8,
            below: rect.top < 190,
          });
        }}
      >
        <MoreHorizontal size={21} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={menuRef}
          className={`group-activity-composer-menu${position.below ? " below" : ""}`}
          role="menu"
          aria-label={trUi("chat.createActivity")}
          style={{ left: position.left, top: position.top }}
        >
          {(["poll", "note", "reminder"] as const).map((kind) => {
            const Icon = icons[kind];
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onCreate(kind);
                }}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{labels[kind]}</span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
