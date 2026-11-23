import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Search, X } from "lucide-react";
import { cn } from "../lib/utils";

const searchFieldVariants = cva(
  "flex w-full min-w-0 items-center gap-2 rounded-ui-md border border-border bg-surface-input px-3 text-muted-foreground transition-colors focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20",
  {
    variants: { size: { default: "h-control-touch", sm: "h-control-md" } },
    defaultVariants: { size: "default" },
  },
);

type SearchFieldProps = Omit<React.ComponentProps<"input">, "size" | "value" | "onChange" | "className"> &
  VariantProps<typeof searchFieldVariants> & {
    value: string;
    onValueChange: (value: string) => void;
    /** Sizes the field (width, flex, max-width); the field fills whatever box the caller gives it. */
    className?: string;
    clearLabel?: string;
    /** Optional control after the clear button, e.g. a submit icon button. */
    trailing?: React.ReactNode;
  };

/** Presentational search box: icon, input and clear button. Suggestions, submit and history stay with the caller. */
function SearchField({ value, onValueChange, size, className, clearLabel = "Xóa từ khóa", trailing, ...props }: SearchFieldProps) {
  return (
    <div data-slot="search-field" className={cn(searchFieldVariants({ size }), className)}>
      <Search size={18} aria-hidden="true" className="shrink-0 text-primary" />
      <input
        data-slot="search-field-input"
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[length:var(--soco-type-body)] font-medium text-foreground outline-none! placeholder:font-normal placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
      {trailing}
    </div>
  );
}

export { SearchField, searchFieldVariants };
