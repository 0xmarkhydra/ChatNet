import { useId, useState } from 'react'
import { Check, ChevronDown, FileText, LayoutGrid, Package, RotateCcw, UserRound, UsersRound } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { FILTER_GROUPS, GROUPS_FOR, SEARCH_TYPES, isDefault, optionLabel, type FilterId, type FilterValues, type SearchType } from '../lib/searchFilters'
import { link, plainButton } from './ui'

const TYPE_ICONS = { all: LayoutGrid, people: UserRound, posts: FileText, communities: UsersRound, products: Package }

export type SearchFilterPanelProps = {
  type: SearchType
  values: FilterValues
  minPrice: string
  maxPrice: string
  onType: (type: SearchType) => void
  onFilter: (id: FilterId, value: string) => void
  onPrice: (key: 'min' | 'max', value: string) => void
  onReset: () => void
  showTypes?: boolean
}

const priceInput = 'h-10 min-w-0 flex-1 rounded-ui-sm border border-border bg-card px-ui-3 text-[length:var(--soco-type-body)] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:h-11'

export default function SearchFilterPanel({ type, values, minPrice, maxPrice, onType, onFilter, onPrice, onReset, showTypes = true }: SearchFilterPanelProps) {
  const [openGroup, setOpenGroup] = useState<FilterId | null>(null)
  const groups = GROUPS_FOR[type]
  const idPrefix = useId()

  return (
    <div className="flex flex-col gap-ui-1">
      {showTypes && (
        <div className="mb-ui-2 grid gap-0.5 border-b border-border pb-ui-3" role="group" aria-label="Loại kết quả">
          {SEARCH_TYPES.map(item => {
            const Icon = TYPE_ICONS[item.key]
            const selected = type === item.key
            return (
              <button key={item.key} type="button" aria-pressed={selected} onClick={() => onType(item.key)}
                className={cn(plainButton, 'flex min-h-11 items-center gap-ui-3 rounded-ui-sm px-ui-2 text-[length:var(--soco-type-body)]! font-semibold! hover:bg-muted',
                  selected && 'bg-secondary text-primary hover:bg-secondary')}>
                <span aria-hidden="true" className={cn('inline-grid size-8.5 place-items-center rounded-ui-sm',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}><Icon size={18} /></span>
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      <div className={cn('flex items-center px-ui-2 py-ui-1', showTypes ? 'justify-between' : 'justify-end')}>
        {showTypes && <h3 className="m-0 text-[length:var(--soco-type-subtitle)] font-bold text-foreground">Bộ lọc</h3>}
        <button type="button" className={link} onClick={onReset}><RotateCcw size={14} aria-hidden="true" /> Đặt lại</button>
      </div>

      {groups.map(id => {
        const group = FILTER_GROUPS[id]
        const open = openGroup === id
        const panelId = idPrefix + id
        const changed = !isDefault(id, values[id])
        return (
          <div key={id} className="border-b border-border last:border-b-0">
            <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenGroup(open ? null : id)}
              className={cn(plainButton, 'grid min-h-13 w-full grid-cols-[minmax(0,1fr)_18px] items-center gap-x-ui-2 rounded-ui-sm p-ui-2 hover:bg-muted')}>
              <span className="text-[length:var(--soco-type-body)] font-semibold">{group.label}</span>
              <span className={cn('text-[length:var(--soco-type-caption)]', changed ? 'font-semibold text-primary' : 'text-muted-foreground')}>{optionLabel(id, values[id])}</span>
              <ChevronDown size={18} aria-hidden="true"
                className={cn('col-start-2 row-span-2 row-start-1 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
            </button>
            {open && (
              <div id={panelId} className="grid gap-0.5 pb-ui-2" role="group" aria-label={group.label}>
                {group.options.map(option => {
                  const selected = values[id] === option.value
                  return (
                    <button key={option.value} type="button" aria-pressed={selected} onClick={() => onFilter(id, option.value)}
                      className={cn(plainButton, 'flex min-h-10 items-center justify-between rounded-ui-sm px-ui-3 text-[length:var(--soco-type-body)]! hover:bg-muted max-lg:min-h-11',
                        selected && 'bg-secondary font-semibold! text-primary hover:bg-secondary')}>
                      {option.label}
                      {selected && <Check size={16} aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {type === 'products' && (
        <fieldset className="m-0 border-0 p-ui-2">
          <legend className="mb-ui-2 p-0 text-[length:var(--soco-type-body)] font-semibold text-foreground">Khoảng giá</legend>
          <div className="flex items-center gap-ui-2 text-muted-foreground">
            <input type="number" inputMode="numeric" min={0} aria-label="Giá thấp nhất" placeholder="Tối thiểu"
              className={priceInput} value={minPrice} onChange={event => onPrice('min', event.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="number" inputMode="numeric" min={0} aria-label="Giá cao nhất" placeholder="Tối đa"
              className={priceInput} value={maxPrice} onChange={event => onPrice('max', event.target.value)} />
          </div>
        </fieldset>
      )}

      {type === 'all' && <p className="m-0 p-ui-2 text-[length:var(--soco-type-caption)] text-muted-foreground">Chọn một loại kết quả để có thêm bộ lọc phù hợp.</p>}
    </div>
  )
}
