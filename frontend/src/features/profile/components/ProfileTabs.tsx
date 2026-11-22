import { useLayoutEffect, useRef, type ReactNode } from 'react'

type Props<T extends string> = {
  idPrefix?: string
  tabs: { id: T; label: string }[]
  active: T
  onChange: (tab: T) => void
  action?: ReactNode
}

export default function ProfileTabs<T extends string>({ idPrefix = 'profile-page', tabs, active, onChange, action }: Props<T>) {
  const tabbarRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const tabbar = tabbarRef.current
    const tab = activeTabRef.current
    if (!tabbar || !tab) return
    const placeIndicator = () => {
      const bar = tabbar.getBoundingClientRect()
      const current = tab.getBoundingClientRect()
      tabbar.style.setProperty('--profile-tab-x', `${current.left - bar.left + tabbar.scrollLeft}px`)
      tabbar.style.setProperty('--profile-tab-width', `${current.width}px`)
      tabbar.classList.add('is-measured')
    }
    placeIndicator()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placeIndicator)
    observer?.observe(tabbar)
    observer?.observe(tab)
    tabbar.addEventListener('scroll', placeIndicator, { passive: true })
    window.addEventListener('resize', placeIndicator)
    return () => {
      observer?.disconnect()
      tabbar.removeEventListener('scroll', placeIndicator)
      window.removeEventListener('resize', placeIndicator)
    }
  }, [active])

  return (
    <div className="profile-page-tabbar" ref={tabbarRef} role="tablist" aria-label="Chọn nội dung hồ sơ">
      <span className="profile-page-tab-indicator" aria-hidden="true" />
      {tabs.map((tab, index) => (
        <button key={tab.id} type="button" role="tab" id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={active === tab.id} aria-controls={`${idPrefix}-tab-content`}
          tabIndex={active === tab.id ? 0 : -1}
          ref={active === tab.id ? activeTabRef : undefined}
          className={active === tab.id ? 'is-active' : ''} onClick={() => onChange(tab.id)}
          onKeyDown={event => {
            const target = event.key === 'ArrowRight' ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (target < 0) return
            event.preventDefault()
            onChange(tabs[target].id)
            tabbarRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus()
          }}>{tab.label}</button>
      ))}
      {action}
    </div>
  )
}
