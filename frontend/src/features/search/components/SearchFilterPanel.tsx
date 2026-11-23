import { useId, useState } from 'react'
import { Check, ChevronDown, FileText, LayoutGrid, Package, RotateCcw, UserRound, UsersRound } from 'lucide-react'
import { FILTER_GROUPS, GROUPS_FOR, SEARCH_TYPES, isDefault, optionLabel, type FilterId, type FilterValues, type SearchType } from '../lib/searchFilters'

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

export default function SearchFilterPanel({ type, values, minPrice, maxPrice, onType, onFilter, onPrice, onReset, showTypes = true }: SearchFilterPanelProps) {
  const [openGroup, setOpenGroup] = useState<FilterId | null>(null)
  const groups = GROUPS_FOR[type]
  const idPrefix = useId()

  return (
    <div className="srch-filters">
      {showTypes && <div className="srch-types" role="group" aria-label="Loại kết quả">
        {SEARCH_TYPES.map(item => {
          const Icon = TYPE_ICONS[item.key]
          return (
            <button key={item.key} type="button" aria-pressed={type === item.key}
              className={type === item.key ? 'srch-type selected' : 'srch-type'} onClick={() => onType(item.key)}>
              <span className="srch-type-icon" aria-hidden="true"><Icon size={18} /></span>{item.label}
            </button>
          )
        })}
      </div>}

      <div className="srch-filter-head">
        <h3>Bộ lọc</h3>
        <button type="button" className="srch-link" onClick={onReset}><RotateCcw size={14} aria-hidden="true" /> Đặt lại</button>
      </div>

      {groups.map(id => {
        const group = FILTER_GROUPS[id]
        const open = openGroup === id
        const panelId = idPrefix + id
        return (
          <div key={id} className={open ? 'srch-acc open' : 'srch-acc'}>
            <button type="button" className="srch-acc-head" aria-expanded={open} aria-controls={panelId}
              onClick={() => setOpenGroup(open ? null : id)}>
              <span className="srch-acc-label">{group.label}</span>
              <span className={isDefault(id, values[id]) ? 'srch-acc-value' : 'srch-acc-value active'}>{optionLabel(id, values[id])}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            {open && (
              <div id={panelId} className="srch-acc-body" role="group" aria-label={group.label}>
                {group.options.map(option => (
                  <button key={option.value} type="button" aria-pressed={values[id] === option.value}
                    className="srch-option" onClick={() => onFilter(id, option.value)}>
                    {option.label}
                    {values[id] === option.value && <Check size={16} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {type === 'products' && (
        <fieldset className="srch-price">
          <legend>Khoảng giá</legend>
          <div className="srch-price-row">
            <input type="number" inputMode="numeric" min={0} aria-label="Giá thấp nhất" placeholder="Tối thiểu"
              value={minPrice} onChange={event => onPrice('min', event.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="number" inputMode="numeric" min={0} aria-label="Giá cao nhất" placeholder="Tối đa"
              value={maxPrice} onChange={event => onPrice('max', event.target.value)} />
          </div>
        </fieldset>
      )}

      {type === 'all' && <p className="srch-hint">Chọn một loại kết quả để có thêm bộ lọc phù hợp.</p>}
    </div>
  )
}
