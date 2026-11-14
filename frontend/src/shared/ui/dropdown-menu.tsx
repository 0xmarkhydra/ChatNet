import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

const DropdownMenu = DropdownPrimitive.Root;
const DropdownMenuTrigger = DropdownPrimitive.Trigger;
const DropdownMenuGroup = DropdownPrimitive.Group;
const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;
const DropdownMenuSeparator = ({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Separator>) => (
  <DropdownPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
);

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn("z-100 min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn("relative flex min-h-10 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label> & { inset?: boolean }) {
  return <DropdownPrimitive.Label data-slot="dropdown-menu-label" className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground", inset && "pl-8", className)} {...props} />;
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      checked={checked}
      className={cn("relative flex min-h-10 cursor-default select-none items-center rounded-lg py-2 pr-3 pl-8 text-sm outline-none focus:bg-accent data-[disabled]:opacity-50", className)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownPrimitive.ItemIndicator><Check size={14} aria-hidden="true" /></DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}

function DropdownMenuSubTrigger({ className, children, inset, ...props }: React.ComponentProps<typeof DropdownPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <DropdownPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn("flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent", inset && "pl-8", className)}
      {...props}
    >
      {children}<ChevronRight size={16} className="ml-auto" aria-hidden="true" />
    </DropdownPrimitive.SubTrigger>
  );
}
const DropdownMenuSub = DropdownPrimitive.Sub;
const DropdownMenuSubContent = DropdownPrimitive.SubContent;

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
  DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
};
