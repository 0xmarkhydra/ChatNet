import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/utils";

/** Feature-agnostic card surface. Use asChild to preserve article/section semantics. */
type CardProps = React.ComponentProps<"section"> & { asChild?: boolean };

function Card({ className, asChild = false, ...props }: CardProps) {
  const Component = asChild ? Slot : "section";
  return (
    <Component
      data-slot="card"
      className={cn("min-w-0 rounded-ui-lg border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-ui-2 p-ui-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-ui-section font-semibold leading-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-ui-body text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-ui-4 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex flex-wrap items-center gap-ui-2 p-ui-4 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
