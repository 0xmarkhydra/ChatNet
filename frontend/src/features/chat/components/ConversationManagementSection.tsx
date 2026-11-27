import type { ReactNode } from 'react'

export default function ConversationManagementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="conversation-info-group-menu" aria-label={title}>
      <strong className="conversation-info-group-menu-heading">{title}</strong>
      {children}
    </section>
  )
}
