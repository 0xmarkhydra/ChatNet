import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'

export function useCallOverlayDismiss(
  moreOpen: boolean,
  translationSheetOpen: boolean,
  moreRef: RefObject<HTMLDivElement | null>,
  setMoreOpen: Dispatch<SetStateAction<boolean>>,
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (moreOpen) setMoreOpen(false)
      else if (translationSheetOpen) setTranslationSheetOpen(false)
    }
    const closeMenuOutside = (event: PointerEvent) => {
      if (moreOpen && event.target instanceof Node && !moreRef.current?.contains(event.target)) {
        setMoreOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    window.addEventListener('pointerdown', closeMenuOutside)
    return () => {
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('pointerdown', closeMenuOutside)
    }
  }, [moreOpen, translationSheetOpen])
}
