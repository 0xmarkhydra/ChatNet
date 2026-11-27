import type { ReactNode, ComponentProps } from 'react'
import { ChevronRight } from 'lucide-react'

export default function ConversationManagementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="conversation-info-group-menu" aria-label={title}>
      <strong className="conversation-info-group-menu-heading">{title}</strong>
      {children}
    </section>
  )
}
/** Shared row for direct, group and channel information menus. */
export function ConversationOptionRow({ icon, children, chevron = true, ...props }: Omit<ComponentProps<'button'>, 'type'> & { icon: ReactNode; chevron?: boolean }) {
  return <button type="button" {...props}>
    {icon}<span className="min-w-0 flex-1 text-left wrap-anywhere">{children}</span>{chevron && <ChevronRight size={16} aria-hidden="true" className="shrink-0"/>}
  </button>
}
