import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type PageHeaderTab = { id: string; label: string; disabled?: boolean }

type PageHeaderProps = {
  title: string
  tabs?: readonly PageHeaderTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  search?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Page-owned toolbar. The surrounding page owns scrolling; this component never does. */
export default function PageHeader({ title, tabs, activeTab, onTabChange, search, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex min-h-14 min-w-0 flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2 md:px-6', className)}>
      <h1 className="m-0 shrink-0 text-lg font-bold text-foreground">{title}</h1>
      {tabs && tabs.length > 0 && (
        <div role="tablist" aria-label={`Điều hướng ${title}`} className="flex min-w-0 flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              disabled={tab.disabled}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={cn('min-h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', activeTab === tab.id && 'bg-primary/10 text-primary')}
              onClick={() => onTabChange?.(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
                const available = tabs.filter((item) => !item.disabled)
                if (!available.length) return
                const index = available.findIndex((item) => item.id === tab.id)
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length
                event.preventDefault()
                onTabChange?.(available[next].id)
                const host = event.currentTarget.parentElement
                const target = host?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                const nextIndex = tabs.findIndex((item) => item.id === available[next].id)
                target?.[nextIndex]?.focus()
              }}
            >{tab.label}</button>
          ))}
        </div>
      )}
      {search && <div className="min-w-0 flex-1">{search}</div>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  )
}
