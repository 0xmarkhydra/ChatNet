import { useEffect, useRef, useState } from "react";
import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "../../shared/ui/input";
import { SearchField } from "../../shared/ui/search-field";
import SearchForm from "../../features/search/components/SearchForm";

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
  /** Use the shared SearchForm on mobile; navigate only after submitting a query. */
  onMobileSearchSubmit?: (query: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Context-specific results rendered under the input (e.g. chat quick search). */
  results?: ReactNode;
  icon: ReactNode;
};

export default function HeaderSearch({
  anchorRef, value, placeholder, ariaLabel, maxLength, expanded, controls,
  onChange, onFocus, onClick, onMobileSearchSubmit, onKeyDown, results, icon,
}: HeaderSearchProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen && !onMobileSearchSubmit) inputRef.current?.focus();
  }, [mobileOpen, onMobileSearchSubmit]);

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
      <span className="contents app-desktop:hidden">
        {onMobileSearchSubmit ? (
          mobileOpen && (
            <div className="appbar-search !border-0 !bg-transparent !p-0" onKeyDown={(event) => {
              if (event.key === "Escape") closeMobileSearch();
            }}>
              <SearchForm
                className="w-full"
                initialQuery=""
                placeholder="Tìm người, bài viết, cộng đồng, sản phẩm…"
                autoFocus
                onSubmit={(query) => {
                  closeMobileSearch();
                  onMobileSearchSubmit(query);
                }}
              />
            </div>
          )
        ) : (
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
        )}
      </span>
      {results}
    </div>
  );
}