import { useUiTranslation } from '@/shared/i18n/locale'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * The one header of the Search page (64px like the layout header): title on the left, then the search field.
 * It follows the results grid (filter column, then results/rail) in every state, so the field stays in the
 * same spot whether or not a search has started and lines up with the result cards.
 */
export default function SearchHeader({ className, children }: { className?: string; children: ReactNode }) {
  const trUi = useUiTranslation()

  return (
    <header className={cn('grid min-h-16 grid-cols-[340px_minmax(0,1fr)] items-center border-b border-border-subtle bg-card max-xl:grid-cols-[300px_minmax(0,1fr)] max-lg:grid-cols-1 max-lg:px-ui-3', className)}>
      {/* Legacy global h1 rules are unlayered, so the title utilities need the important modifier. */}
      <h1 className="m-0! px-ui-6 text-[length:var(--soco-type-page)]! font-bold tracking-[-0.3px]! text-foreground max-lg:sr-only">{trUi("common.search")}</h1>{/* design-debt-ignore: the global h1 rule in styles.css wins over layered utilities */}
      <div className="grid min-w-0 xl:grid-cols-[min(calc(50%_+_210px),calc(100%_-_336px))_320px]">
        <div className="mx-auto w-full max-w-190 min-w-0 px-ui-4 max-lg:px-0">{children}</div>
      </div>
    </header>
  )
}
