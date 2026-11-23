// Preflight is disabled, so native button chrome is reset explicitly. Legacy unlayered `button{font:inherit}`
// beats layered utilities, so font size/weight on buttons use the important modifier.
export const plainButton = 'cursor-pointer border-0 bg-transparent p-0 text-left text-foreground'

export const card = 'rounded-ui-md bg-card p-ui-4 shadow-ui-sm'
export const cardHead = 'mb-ui-3 flex items-center justify-between gap-ui-3'
export const cardTitle = 'm-0 text-[length:var(--soco-type-subtitle)] font-bold text-foreground'
export const sectionTitle = 'm-0 text-[length:var(--soco-type-section)] font-bold text-foreground'

export const link = 'inline-flex min-h-6 cursor-pointer items-center gap-ui-1 border-0 bg-transparent p-0 text-[length:var(--soco-type-label)]! font-semibold! text-primary hover:underline max-lg:min-h-11'
export const iconButton = 'inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-muted max-lg:size-11'
export const inline = 'm-0 py-ui-2 text-[length:var(--soco-type-label)] text-muted-foreground'

export const rowCopy = 'grid min-w-0 flex-1 gap-0.5 text-left'
export const rowTitle = 'truncate text-[length:var(--soco-type-body)] font-semibold text-foreground'
export const rowMeta = 'text-[length:var(--soco-type-caption)] text-muted-foreground'
export const clamp2 = 'line-clamp-2'

export const avatar = 'size-12 shrink-0 text-[length:var(--soco-type-label)] font-bold'
export const avatarSmall = 'size-9 shrink-0 text-[length:var(--soco-type-caption)] font-bold'
export const iconTile = 'inline-grid size-12 shrink-0 place-items-center rounded-ui-md bg-secondary text-primary'
export const emptyIcon = 'inline-grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-primary'

export const touchButton = 'max-lg:h-11'
