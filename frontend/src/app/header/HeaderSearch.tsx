import { useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "../../shared/ui/input";
import { SearchField } from "../../shared/ui/search-field";

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
  /** Navigate to the shared Search page instead of expanding the mobile input. */
  onMobileSearchOpen?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Context-specific results rendered under the input (e.g. chat quick search). */
  results?: ReactNode;
  icon: ReactNode;
};

export default function HeaderSearch({
  anchorRef, value, placeholder, ariaLabel, maxLength, expanded, controls,
  onChange, onFocus, onClick, onMobileSearchOpen, onKeyDown, results, icon,
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
      <button className="appbar-mobile-search-trigger" type="button" aria-label="Mở tìm kiếm" aria-expanded={onMobileSearchOpen ? undefined : mobileOpen} onClick={() => onMobileSearchOpen ? onMobileSearchOpen() : setMobileOpen(true)}>
        <Search size={23} aria-hidden="true" />
      </button>
      <button className="appbar-mobile-search-back" type="button" aria-label="Đóng tìm kiếm" onClick={closeMobileSearch}>
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <SearchField
        className="app-mobile:hidden"
        value={value}
        onValueChange={onChange}
        maxLength={maxLength}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={onFocus}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />
      {/* Phones keep the legacy expanding search overlay (.appbar-search rules); desktop uses SearchField above. */}
      <span className="contents app-desktop:hidden"><label className="appbar-search">
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
      </label></span>
      {results}
    </div>
  );
}