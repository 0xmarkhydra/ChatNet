import * as React from "react";
import { cn } from "../lib/utils";

/** Loading placeholder block. Decorative: pair it with a status message for assistive technology. */
function Skeleton({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("block animate-pulse rounded-ui-sm bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
