type Bounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>

type ViewportBounds = { left: number; top: number; width: number; height: number }

export type ChatComposerMenuPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
}

/** Position in the visible viewport; the portaled menu is never clipped by chat panels. */
export function positionChatComposerMenu(
  trigger: Bounds,
  viewport: ViewportBounds,
  wantedHeight: number,
): ChatComposerMenuPosition {
  const inset = 12
  const gap = 8
  const width = Math.min(350, Math.max(1, viewport.width - inset * 2))
  const visibleLeft = viewport.left + inset
  const visibleTop = viewport.top + inset
  const visibleBottom = viewport.top + viewport.height - inset
  const below = Math.max(0, visibleBottom - trigger.bottom - gap)
  const above = Math.max(0, trigger.top - visibleTop - gap)
  const openAbove = above >= Math.min(wantedHeight, 260) || above >= below
  const available = openAbove ? above : below
  const maxHeight = Math.max(0, Math.min(wantedHeight, available))
  const left = Math.max(visibleLeft, Math.min(trigger.left, viewport.left + viewport.width - inset - width))
  const top = openAbove ? trigger.top - gap - maxHeight : trigger.bottom + gap
  return {
    left,
    top: Math.max(visibleTop, Math.min(top, visibleBottom - maxHeight)),
    width,
    maxHeight,
  }
}
