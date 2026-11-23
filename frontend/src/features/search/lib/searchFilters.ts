import type { Post } from '../../feed'
import type { CommunityResult, PersonResult, ProductResult } from '../api/search'

export type SearchType = 'all' | 'people' | 'posts' | 'communities' | 'products'
export const SEARCH_TYPES: { key: SearchType; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'people', label: 'Mọi người' },
  { key: 'posts', label: 'Bài viết' },
  { key: 'communities', label: 'Cộng đồng' },
  { key: 'products', label: 'Sản phẩm' },
]

type Option = { value: string; label: string }
type GroupDef = { label: string; options: Option[] }

/** Only filters the current APIs can honour; each option's first value is the default. */
export const FILTER_GROUPS = {
  sort: { label: 'Sắp xếp theo', options: [{ value: 'relevant', label: 'Liên quan nhất' }, { value: 'newest', label: 'Mới nhất' }] },
  time: { label: 'Ngày đăng', options: [
    { value: 'any', label: 'Bất kỳ lúc nào' }, { value: 'day', label: '24 giờ qua' },
    { value: 'week', label: '7 ngày qua' }, { value: 'month', label: '30 ngày qua' },
  ] },
  in: { label: 'Nguồn', options: [
    { value: 'all', label: 'Mọi bài viết' }, { value: 'following', label: 'Người bạn theo dõi' }, { value: 'saved', label: 'Bài viết đã lưu' },
  ] },
  has: { label: 'Có chứa', options: [{ value: 'any', label: 'Bất kỳ' }, { value: 'image', label: 'Ảnh' }, { value: 'video', label: 'Video' }] },
  status: { label: 'Trạng thái', options: [{ value: 'any', label: 'Bất kỳ' }, { value: 'online', label: 'Đang hoạt động' }] },
  gsort: { label: 'Sắp xếp theo', options: [{ value: 'relevant', label: 'Liên quan nhất' }, { value: 'members', label: 'Nhiều thành viên nhất' }] },
  psort: { label: 'Sắp xếp theo', options: [
    { value: 'newest', label: 'Mới đăng' }, { value: 'price-asc', label: 'Giá thấp đến cao' }, { value: 'price-desc', label: 'Giá cao đến thấp' },
  ] },
  stock: { label: 'Tình trạng', options: [{ value: 'any', label: 'Bất kỳ' }, { value: 'in', label: 'Còn hàng' }] },
} satisfies Record<string, GroupDef>

export type FilterId = keyof typeof FILTER_GROUPS
export type FilterValues = Record<FilterId, string>

export const GROUPS_FOR: Record<SearchType, FilterId[]> = {
  all: ['sort', 'time'],
  people: ['status'],
  posts: ['in', 'sort', 'time', 'has'],
  communities: ['gsort'],
  products: ['psort', 'stock'],
}

const FILTER_IDS = Object.keys(FILTER_GROUPS) as FilterId[]

export function parseType(value: string | null): SearchType {
  return SEARCH_TYPES.some(item => item.key === value) ? value as SearchType : 'all'
}

export function parseFilters(params: URLSearchParams): FilterValues {
  const values = {} as FilterValues
  for (const id of FILTER_IDS) {
    const options = FILTER_GROUPS[id].options
    const raw = id === 'time' && !params.has('time') && params.get('range') === '30d' ? 'month' : params.get(id)
    values[id] = options.some(option => option.value === raw) ? raw as string : options[0].value
  }
  return values
}

export function parsePrice(value: string | null) {
  const number = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export const isDefault = (id: FilterId, value: string) => FILTER_GROUPS[id].options[0].value === value
export const optionLabel = (id: FilterId, value: string) =>
  (FILTER_GROUPS[id].options as Option[]).find(option => option.value === value)?.label ?? value

/** Active, non-default filters visible for the current type, in display order. */
export function activeFilters(type: SearchType, values: FilterValues) {
  return GROUPS_FOR[type].filter(id => !isDefault(id, values[id])).map(id => ({ id, label: optionLabel(id, values[id]) }))
}

const TIME_WINDOW: Record<string, number> = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5 }

export const foldText = (value: string) => value.toLocaleLowerCase('vi-VN')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export const isPublicPost = (post: Post) => post.visibility === 'public'

export function filterPosts(posts: Post[], values: FilterValues, now: number) {
  const window = TIME_WINDOW[values.time]
  const result = posts.filter(post => {
    if (values.in === 'all' && !isPublicPost(post)) return false
    if (window && now - new Date(post.createdAt).getTime() > window) return false
    if (values.has !== 'any' && !post.attachments?.some(item => item.kind === values.has)) return false
    return true
  })
  return values.sort === 'newest'
    ? result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : result
}

export const filterPeople = (people: PersonResult[], values: FilterValues) =>
  values.status === 'online' ? people.filter(person => person.online) : people

export const filterCommunities = (communities: CommunityResult[], values: FilterValues) =>
  values.gsort === 'members' ? [...communities].sort((a, b) => b.memberCount - a.memberCount) : communities

export function filterProducts(products: ProductResult[], query: string, values: FilterValues, min: number | null, max: number | null) {
  const needle = foldText(query)
  const result = products.filter(product =>
    foldText(product.title + ' ' + product.description).includes(needle) &&
    (values.stock !== 'in' || product.stock > 0) &&
    (min === null || product.priceAmount >= min) &&
    (max === null || product.priceAmount <= max))
  if (values.psort === 'price-asc') result.sort((a, b) => a.priceAmount - b.priceAmount)
  if (values.psort === 'price-desc') result.sort((a, b) => b.priceAmount - a.priceAmount)
  return result
}

export const formatPrice = (amount: number, unit: string) => amount.toLocaleString('vi-VN') + ' ' + unit

/** Filters outside the current type's groups fall back to their defaults. */
export function effectiveFilters(type: SearchType, values: FilterValues): FilterValues {
  const result = { ...values }
  for (const id of FILTER_IDS) if (!GROUPS_FOR[type].includes(id)) result[id] = FILTER_GROUPS[id].options[0].value
  return result
}
