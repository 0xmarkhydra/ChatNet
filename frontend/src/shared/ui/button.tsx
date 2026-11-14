import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        outline: "border border-border bg-card text-foreground hover:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-10",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

/** Shared SocCO button for new screens; existing feature buttons migrate deliberately. */
function Button({ className, variant, size, asChild = false, type = "button", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...(!asChild ? { type } : {})}
      {...props}
    />
  );
}

export { Button, buttonVariants };
