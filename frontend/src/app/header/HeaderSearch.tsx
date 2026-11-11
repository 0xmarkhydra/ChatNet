import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

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
  return (
    <div className="appbar-search-anchor" ref={anchorRef}>
      <label className="appbar-search">
        {icon}
        <input
          value={value}
          maxLength={maxLength}
          type="search"
          onKeyDown={onKeyDown}
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
