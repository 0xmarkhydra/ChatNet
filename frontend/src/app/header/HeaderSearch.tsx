import { useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "../../shared/ui/input";

export type HeaderSearchProps = {
  anchorRef: RefObject<HTMLDivElement | null>;
  value: string;
  placeholder: string;
  ariaLabel: string;
  maxLength?: number;
  expanded?: boolean;
  controls?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onClick?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Context-specific results rendered under the input (e.g. chat quick search). */
  results?: ReactNode;
  icon: ReactNode;
};

export default function HeaderSearch({
  anchorRef, value, placeholder, ariaLabel, maxLength, expanded, controls,
  onChange, onFocus, onClick, onKeyDown, results, icon,
}: HeaderSearchProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  const closeMobileSearch = () => {
    setMobileOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className={`appbar-search-anchor${mobileOpen ? " mobile-search-expanded" : ""}`} ref={anchorRef}>
      <button className="appbar-mobile-search-trigger" type="button" aria-label="Mở tìm kiếm" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
        <Search size={23} aria-hidden="true" />
      </button>
      <button className="appbar-mobile-search-back" type="button" aria-label="Đóng tìm kiếm" onClick={closeMobileSearch}>
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <label className="appbar-search">
        {icon}
        <Input
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          type="search"
          onKeyDown={(event) => {
            if (event.key === "Escape" && mobileOpen) closeMobileSearch();
            onKeyDown?.(event);
          }}
          aria-expanded={expanded}
          aria-controls={controls}
          onFocus={onFocus}
          onClick={onClick}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      </label>
      {results}
    </div>
  );
}