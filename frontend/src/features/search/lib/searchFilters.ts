import { createUiTranslator, type UiCopyKey } from '@/shared/i18n/locale'
import type { Post } from '../../feed'
import type { CommunityResult, PersonResult, ProductResult } from '../api/search'

export type SearchType = 'all' | 'people' | 'posts' | 'communities' | 'products'
export const SEARCH_TYPES: { key: SearchType; label: UiCopyKey }[] = [
  { key: 'all', label: 'common.all' },
  { key: 'people', label: 'discover.people' },
  { key: 'posts', label: 'discover.posts' },
  { key: 'communities', label: 'discover.communities' },
  { key: 'products', label: 'common.ui.productTitle' },
]

type Option = { value: string; label: UiCopyKey }
type GroupDef = { label: UiCopyKey; options: Option[] }

/** Only filters the current APIs can honour; each option's first value is the default. */
export const FILTER_GROUPS = {
  sort: { label: 'search.sortBy', options: [{ value: 'relevant', label: 'search.relevant' }, { value: 'newest', label: 'common.newest' }] },
  time: { label: 'search.postedDate', options: [
    { value: 'any', label: 'search.anyTime' }, { value: 'day', label: 'search.lastDay' },
    { value: 'week', label: 'search.lastWeek' }, { value: 'month', label: 'search.lastMonth' },
  ] },
  in: { label: 'search.source', options: [
    { value: 'all', label: 'search.allPosts' }, { value: 'following', label: 'search.following' }, { value: 'saved', label: 'search.savedPosts' },
  ] },
  has: { label: 'search.contains', options: [{ value: 'any', label: 'search.any' }, { value: 'image', label: 'search.photo' }, { value: 'video', label: 'common.ui.video' }] },
  status: { label: 'search.status', options: [{ value: 'any', label: 'search.any' }, { value: 'online', label: 'profile.active' }] },
  gsort: { label: 'search.sortBy', options: [{ value: 'relevant', label: 'search.relevant' }, { value: 'members', label: 'search.mostMembers' }] },
  psort: { label: 'search.sortBy', options: [
    { value: 'newest', label: 'search.recentlyListed' }, { value: 'price-asc', label: 'search.priceAsc' }, { value: 'price-desc', label: 'search.priceDesc' },
  ] },
  stock: { label: 'search.availability', options: [{ value: 'any', label: 'search.any' }, { value: 'in', label: 'search.inStock' }] },
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
export const optionLabel = (id: FilterId, value: string, t = createUiTranslator('vi')) => {
  const option = (FILTER_GROUPS[id].options as Option[]).find(option => option.value === value)
  return option ? t(option.label) : value
}

/** Active, non-default filters visible for the current type, in display order. */
export function activeFilters(type: SearchType, values: FilterValues, t = createUiTranslator('vi')) {
  return GROUPS_FOR[type].filter(id => !isDefault(id, values[id])).map(id => ({ id, label: optionLabel(id, values[id], t) }))
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

export const formatPrice = (amount: number, unit: string, locale = 'vi') => amount.toLocaleString(locale) + ' ' + unit

/** Filters outside the current type's groups fall back to their defaults. */
export function effectiveFilters(type: SearchType, values: FilterValues): FilterValues {
  const result = { ...values }
  for (const id of FILTER_IDS) if (!GROUPS_FOR[type].includes(id)) result[id] = FILTER_GROUPS[id].options[0].value
  return result
}