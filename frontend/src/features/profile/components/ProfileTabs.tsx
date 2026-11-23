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
    <div className="profile-page-tabbar sticky top-0 z-12 mx-auto flex min-h-[61px] w-full max-w-[1060px] items-center gap-1 overflow-x-auto border-t border-[#e8ecf5] bg-white px-6 shadow-[0_2px_10px_rgba(30,51,96,.06)] max-[760px]:min-h-[52px] max-[760px]:px-2.5" ref={tabbarRef} role="tablist" aria-label="Chọn nội dung hồ sơ">
      <span className="profile-page-tab-indicator" aria-hidden="true" />
      {tabs.map((tab, index) => (
        <button key={tab.id} type="button" role="tab" id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={active === tab.id} aria-controls={`${idPrefix}-tab-content`}
          tabIndex={active === tab.id ? 0 : -1}
          ref={active === tab.id ? activeTabRef : undefined}
          className={`relative z-[1] my-1.5 min-h-12 shrink-0 cursor-pointer rounded-[10px] border-0 bg-transparent px-[18px] text-[15px] font-medium text-[#697894] transition-colors duration-200 hover:bg-[#eff4ff] max-[760px]:min-h-11 max-[760px]:px-3 ${active === tab.id ? 'is-active font-semibold text-[#2563eb]' : ''}`} onClick={() => onChange(tab.id)}
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