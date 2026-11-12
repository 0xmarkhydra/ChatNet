import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import './sliding-pill.css'

export default function useSlidingPill<Host extends HTMLElement = HTMLElement>(activeKey: string) {
  const hostNode = useRef<Host>(null)
  const activeNode = useRef<HTMLButtonElement>(null)
  const pillNode = useRef<HTMLSpanElement>(null)
  const [refVersion, setRefVersion] = useState(0)
  const previousKey = useRef<string | null>(null)
  const hostRef = useCallback((node: Host | null) => {
    hostNode.current = node
    setRefVersion((version) => version + 1)
  }, [])
  const activeRef = useCallback((node: HTMLButtonElement | null) => {
    activeNode.current = node
    setRefVersion((version) => version + 1)
  }, [])
  const pillRef = useCallback((node: HTMLSpanElement | null) => {
    pillNode.current = node
    setRefVersion((version) => version + 1)
  }, [])

  useLayoutEffect(() => {
    const host = hostNode.current
    const active = activeNode.current
    const pill = pillNode.current
    if (!host || !pill) return
    if (!active) {
      pill.classList.remove('is-ready', 'is-sliding')
      return
    }

    const measure = (animate = false) => {
      const hostRect = host.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      const left = activeRect.left - hostRect.left - host.clientLeft + host.scrollLeft
      const top = activeRect.top - hostRect.top - host.clientTop + host.scrollTop
      const previousLeft = Number.parseFloat(pill.style.left)

      pill.style.left = `${left}px`
      pill.style.top = `${top}px`
      pill.style.width = `${activeRect.width}px`
      pill.style.height = `${activeRect.height}px`

      if (!pill.classList.contains('is-ready')) {
        void pill.offsetWidth
        pill.classList.add('is-ready')
      }

      if (animate) {
        pill.dataset.direction = left >= (Number.isNaN(previousLeft) ? left : previousLeft) ? 'forward' : 'backward'
        pill.classList.remove('is-sliding')
        void pill.offsetWidth
        pill.classList.add('is-sliding')
      }
    }

    const animate = previousKey.current !== null && previousKey.current !== activeKey
    previousKey.current = activeKey
    measure(animate)
    const update = () => measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(host)
    observer?.observe(active)
    host.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      observer?.disconnect()
      host.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [activeKey, refVersion])

  return { hostRef, activeRef, pillRef }
}
