import { useEffect, type RefObject } from 'react'

const SCROLL_SELECTOR = '.feed-view'
const MIN_DELTA = 8

/** Hides the app header and bottom navigation while the feed scrolls down; shows them on scroll up. */
export function useScrollHideChrome(navRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const shell = navRef.current?.closest<HTMLElement>('.modern-shell')
    if (!shell || !enabled) return

    let lastTop = 0
    const setHidden = (hidden: boolean) => {
      if (hidden) {
        const header = shell.querySelector<HTMLElement>(':scope > header')
        shell.style.setProperty('--chrome-header-h', `${header?.offsetHeight ?? 0}px`)
        shell.dataset.chromeHidden = ''
      } else {
        delete shell.dataset.chromeHidden
      }
    }

    const onScroll = (event: Event) => {
      const el = event.target
      if (!(el instanceof HTMLElement) || !el.matches(SCROLL_SELECTOR)) return
      const top = el.scrollTop
      if (top <= 0) setHidden(false)
      else if (top - lastTop > MIN_DELTA) setHidden(true)
      else if (lastTop - top > MIN_DELTA) setHidden(false)
      else return
      lastTop = top
    }

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      delete shell.dataset.chromeHidden
    }
  }, [navRef, enabled])
}
