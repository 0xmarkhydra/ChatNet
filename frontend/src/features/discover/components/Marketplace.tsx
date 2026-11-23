import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowLeft, ClipboardList, Info, PackageSearch, Plus, PlusCircle, Search, ShoppingBag, ShoppingCart } from 'lucide-react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { cn } from '../../../shared/lib/utils'

type Product = {
  id: number; sellerId: number; title: string; description: string
  priceAmount: number; priceUnit: string; stock: number
  status: 'draft' | 'published' | 'archived'
}
type CartItem = Product & { quantity: number }
type Order = {
  id: number; sellerId: number; amountTotal: number
  priceUnit: string; status: string; createdAt: string
}
type Props = {
  userId: number
  searchQuery: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  onBack: () => void
}
const showMoney = (n: number, unit: string) => n.toLocaleString('vi-VN') + ' ' + unit
const sortOptions = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'priceAsc', label: 'Giá thấp' },
  { id: 'priceDesc', label: 'Giá cao' },
] as const
type SortId = typeof sortOptions[number]['id']
const noticeCls = 'mb-3.5 rounded-2xl px-3.5 py-3 text-[13px]'
const gridCls = 'grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-4'
const emptyCls = 'grid justify-items-center gap-2.5 px-4 py-12 text-center text-muted-foreground'
const panelCls = 'grid gap-2.5 rounded-[18px] border border-border bg-card p-4'
const rowCls = 'flex items-center justify-between gap-4 border-t border-indigo-50 py-3'
const avatarCls = 'grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-br from-indigo-500 to-purple-500 text-[11px] font-bold not-italic text-white'
const stepCls = 'size-9 cursor-pointer rounded-full border-0 bg-white text-lg text-indigo-800'
const primaryCls = 'min-h-11 w-full cursor-pointer rounded-xl border-0 bg-indigo-600 px-[18px] font-semibold text-white hover:bg-indigo-700'
const chipCls = (active: boolean) => cn('min-h-9 flex-none cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold', active ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-border bg-card text-foreground')

export default function Marketplace({ userId, searchQuery = '', request, onBack }: Props) {
  const apiRef = useLatest(request)
  const revision = useRef(0)
  const readRevision = useRef(0)
  const mutationFlight = useRef<{ version: number } | null>(null)
  const retryFlight = useRef<{ version: number } | null>(null)
  const [view, setView] = useState<'products' | 'cart' | 'orders' | 'sell'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [mine, setMine] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('')
  const [stock, setStock] = useState('1')
  const [sort, setSort] = useState<SortId>('newest')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [query, setQuery] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiRef.current(path, init)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(typeof body?.error === 'string' ? body.error : 'Yêu cầu không thành công')
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
  async function refresh(version = revision.current) {
    const read = ++readRevision.current
    const isCurrent = () => version === revision.current && read === readRevision.current
    try {
      const [catalog, basket, history, owned] = await Promise.all([
        api<{ products: Product[] }>('/api/marketplace/products'),
        api<{ items: CartItem[] }>('/api/marketplace/cart'),
        api<{ orders: Order[] }>('/api/marketplace/orders'),
        api<{ products: Product[] }>('/api/marketplace/products/mine'),
      ])
      if (!isCurrent()) return
      setProducts(catalog.products)
      setCart(basket.items)
      setOrders(history.orders)
      setMine(owned.products)
      setLoaded(true)
      setError('')
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Không tải được sàn')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }
  useEffect(() => {
    const requestRevision = revision
    const version = ++requestRevision.current
    setProducts([]); setCart([]); setOrders([]); setMine([])
    mutationFlight.current = null
    retryFlight.current = null
    setView('products')
    setTitle(''); setDescription(''); setPrice(''); setUnit(''); setStock('1')
    setError(''); setMessage(''); setLoading(true); setLoaded(false); setBusy(false); setRefreshing(false)
    void refresh(version)
    return () => { ++requestRevision.current }
  }, [userId])

  function retryRead() {
    if (retryFlight.current) return
    const flight = { version: revision.current }
    retryFlight.current = flight
    if (!loaded) setLoading(true)
    else setRefreshing(true)
    setError('')
    void refresh(flight.version).finally(() => {
      if (retryFlight.current === flight) {
        retryFlight.current = null
        setRefreshing(false)
      }
    })
  }

  async function execute(fn: (isCurrent: () => boolean) => Promise<void>) {
    if (busy || mutationFlight.current) return
    const version = revision.current
    const flight = { version }
    mutationFlight.current = flight
    const isCurrent = () => version === revision.current
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await fn(isCurrent)
      if (isCurrent()) {
        // A completed write supersedes any older read retry and its spinner.
        retryFlight.current = null
        setRefreshing(false)
        await refresh(version)
      }
    }
    catch (e) { if (version === revision.current) setError(e instanceof Error ? e.message : 'Không thể thực hiện') }
    finally {
      if (mutationFlight.current === flight) {
        mutationFlight.current = null
        if (isCurrent()) setBusy(false)
      }
    }
  }
  const searchTerm = (query.trim() || searchQuery.trim()).toLocaleLowerCase("vi-VN")
  const visibleProducts = searchTerm
    ? products.filter(product => `${product.title} ${product.description}`.toLocaleLowerCase("vi-VN").includes(searchTerm))
    : products
  const minValue = minPrice === '' ? null : Number(minPrice)
  const maxValue = maxPrice === '' ? null : Number(maxPrice)
  const shownProducts = visibleProducts
    .filter(product => !onlyInStock || product.stock > 0)
    .filter(product => (minValue === null || product.priceAmount >= minValue) && (maxValue === null || product.priceAmount <= maxValue))
    .sort((a, b) => sort === 'priceAsc' ? a.priceAmount - b.priceAmount : sort === 'priceDesc' ? b.priceAmount - a.priceAmount : b.id - a.id)
  const basketSellers = Array.from(new Set(cart.map(item => item.sellerId)))
  function updateCart(productId: number, quantity: number) {
    void execute(async (isCurrent) => {
      if (quantity <= 0) {
        await api<void>('/api/marketplace/cart/' + productId, { method: 'DELETE' })
      } else {
        await api<void>('/api/marketplace/cart/' + productId, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
        })
      }
      if (isCurrent()) setMessage('Đã cập nhật giỏ hàng.')
    })
  }
  function checkout(sellerId: number) {
    void execute(async (isCurrent) => {
      const order = await api<{ id: number }>('/api/marketplace/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, idempotencyKey: crypto.randomUUID().replaceAll('-', '') }),
      })
      if (!isCurrent()) return
      setView('orders')
      setMessage('Đã lưu yêu cầu #' + order.id + ' để kiểm thử. Chưa thu tiền, giữ hàng hoặc gửi đơn cho người bán.')
    })
  }
  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void execute(async (isCurrent) => {
      await api('/api/marketplace/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), priceAmount: Number(price),
          priceUnit: unit.toUpperCase().trim(), stock: Number(stock),
        }),
      })
      if (!isCurrent()) return
      setTitle(''); setDescription(''); setPrice(''); setUnit(''); setStock('1')
      setMessage('Đã lưu bản nháp. Bạn cần xác nhận trước khi đăng.')
    })
  }
  function publish(productId: number) {
    void execute(async (isCurrent) => {
      await api('/api/marketplace/products/' + productId + '/publish', { method: 'POST' })
      if (isCurrent()) setMessage('Đã đăng sản phẩm.')
    })
  }
  const inStockCount = products.filter(product => product.stock > 0).length
  const tabs = [
    { id: 'products', label: 'Sản phẩm', Icon: ShoppingBag },
    { id: 'cart', label: 'Giỏ', Icon: ShoppingCart },
    { id: 'orders', label: 'Đơn hàng', Icon: ClipboardList },
    { id: 'sell', label: 'Bán hàng', Icon: PlusCircle },
  ] as const
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-[1360px] flex-col gap-4 px-2.5 py-3 text-foreground sm:gap-5 sm:px-6 sm:py-5 [&_*]:box-border [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-indigo-600 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-60 [&_h2]:m-0 [&_h3]:m-0 [&_p]:m-0">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <button type="button" aria-label="Quay lại Khám phá" onClick={onBack} className="grid size-11 flex-none cursor-pointer place-items-center rounded-2xl border border-border bg-card text-indigo-700 hover:bg-indigo-50"><ArrowLeft size={20}/></button>
        <h1 className="m-0 flex-1 text-2xl font-extrabold tracking-tight sm:flex-none sm:text-[28px]">Marketplace</h1>
        <label className="order-last flex h-12 min-w-0 basis-full items-center gap-2.5 rounded-2xl border border-border bg-card px-4 shadow-xs focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20 sm:order-none sm:h-13 sm:flex-1 sm:basis-80">
          <Search size={20} aria-hidden="true" className="flex-none text-indigo-600"/>
          <span className="sr-only">Tìm trong Marketplace</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm, mô tả..." className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"/>
        </label>
        <button type="button" aria-label={`Giỏ hàng, ${cart.length} sản phẩm`} onClick={() => setView('cart')} className="relative grid size-12 flex-none cursor-pointer place-items-center rounded-2xl border border-border bg-card text-indigo-700 hover:bg-indigo-50 sm:size-13">
          <ShoppingCart size={22} aria-hidden="true"/>
          {cart.length > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[11px] font-bold text-white">{cart.length}</span>}
        </button>
        <button type="button" onClick={() => setView('sell')} className="flex h-12 flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-2xl border-0 bg-indigo-600 px-4 text-[15px] font-bold text-white hover:bg-indigo-700 sm:h-13 sm:px-5"><Plus size={18} aria-hidden="true"/>Đăng tin bán</button>
      </div>
      <div className="flex flex-wrap items-start gap-4 sm:gap-6">
      <aside className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3.5 lg:w-[280px] lg:flex-none">
        <div className="grid gap-2 rounded-[18px] border border-border bg-card p-3 sm:p-4">
          <h2 className="hidden text-base font-extrabold lg:block">Chợ SocCo</h2>
          <nav aria-label="Sàn mua bán" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] lg:grid">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-pressed={view === id}
                onClick={() => setView(id)}
                className={cn('flex min-h-11 flex-none cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl border-0 px-3 text-sm font-semibold transition-colors',
                  view === id ? 'bg-indigo-50 font-bold text-indigo-800' : 'bg-transparent text-foreground hover:bg-indigo-50/60')}>
                <Icon size={20}/> {label}{id === 'cart' && ` (${cart.length})`}
              </button>
            ))}
          </nav>
        </div>
        {view === 'products' && <div className="grid gap-3 rounded-[18px] border border-border bg-card p-4">
          <h2 className="text-base font-extrabold">Bộ lọc</h2>
          <fieldset className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-bold">Khoảng giá</legend>
            <div className="flex items-center gap-2">
              <input type="number" min={0} inputMode="numeric" aria-label="Giá thấp nhất" placeholder="Từ" value={minPrice} onChange={event => setMinPrice(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm"/>
              <span aria-hidden="true" className="text-muted-foreground">-</span>
              <input type="number" min={0} inputMode="numeric" aria-label="Giá cao nhất" placeholder="Đến" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm"/>
            </div>
          </fieldset>
        </div>}
      </aside>
      <div className="min-w-0 flex-[999_1_560px] pb-7 sm:pb-10">
        <p role="note" className="mb-3.5 flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-[13px] text-orange-800"><Info size={15} aria-hidden="true" className="mt-0.5 flex-none"/>Chưa cấu hình phương thức thanh toán. Không thu tiền hoặc đặt đơn thật; chức năng đơn hiện dùng để kiểm thử.</p>

        {loading && <p role="status" aria-busy="true" className={noticeCls + ' bg-indigo-50 text-indigo-800'}>Đang tải dữ liệu chợ…</p>}
        {refreshing && <p role="status" aria-live="polite" aria-busy="true" className={noticeCls + ' bg-indigo-50 text-indigo-800'}>Đang cập nhật dữ liệu chợ…</p>}
        {busy && <p role="status" aria-live="polite" aria-busy="true" className={noticeCls + ' bg-indigo-50 text-indigo-800'}>Đang xử lý yêu cầu…</p>}
        {error && <p role="alert" className={noticeCls + ' flex flex-wrap items-center gap-2 bg-red-50 text-red-800'}>{error} <button onClick={retryRead} type="button" disabled={busy} className="min-h-9 cursor-pointer rounded-full border border-red-300 bg-white px-3.5 font-semibold text-red-800">Thử tải dữ liệu</button></p>}
        {message && <p role="status" className={noticeCls + ' bg-green-50 text-green-800'}>{message}</p>}

        {loading && <div aria-hidden="true" className={gridCls}>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="grid animate-pulse gap-3 overflow-hidden rounded-[18px] border border-border bg-card pb-4 motion-reduce:animate-none">
            <div className="aspect-square bg-slate-200"/><span className="mx-3.5 h-3 rounded-md bg-slate-200"/><span className="mx-3.5 h-3 w-1/2 rounded-md bg-slate-200"/>
          </div>)}
        </div>}

        {!loading && loaded && view === 'products' && <>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div role="group" aria-label="Sắp xếp sản phẩm" className="flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none]">
              {sortOptions.map(option => <button key={option.id} type="button" aria-pressed={sort === option.id}
                onClick={() => setSort(option.id)} className={chipCls(sort === option.id)}>{option.label}</button>)}
              <button type="button" aria-pressed={onlyInStock} onClick={() => setOnlyInStock(value => !value)}
                className={chipCls(onlyInStock)}>Còn hàng ({inStockCount})</button>
            </div>
            <small className="hidden flex-none text-muted-foreground sm:block">{shownProducts.length} sản phẩm</small>
          </div>
          <div className={gridCls}>
            {shownProducts.length === 0 && <p className={emptyCls + ' col-span-full'}><PackageSearch size={32} aria-hidden="true"/>{searchTerm ? 'Không tìm thấy sản phẩm phù hợp.' : onlyInStock && visibleProducts.length > 0 ? 'Không có sản phẩm còn hàng.' : (minValue !== null || maxValue !== null) && visibleProducts.length > 0 ? 'Không có sản phẩm trong khoảng giá này.' : 'Chưa có sản phẩm được đăng.'}</p>}
            {shownProducts.map(p => <article key={p.id} className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-700/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <div className="relative grid aspect-square place-items-center" style={{ '--hue': 232 + (p.id * 37) % 70, background: 'linear-gradient(135deg,hsl(var(--hue) 85% 94%),hsl(calc(var(--hue) + 30) 80% 84%))' } as CSSProperties}>
                <span aria-hidden="true" className="text-5xl font-extrabold text-indigo-700/70 sm:text-6xl">{p.title.trim().charAt(0).toLocaleUpperCase('vi-VN') || '?'}</span>
                {p.stock === 0 && <em className="absolute left-2.5 top-2.5 rounded-full bg-indigo-950 px-2.5 py-1 text-xs font-bold not-italic text-white">Hết hàng</em>}
                {p.stock > 0 && p.stock <= 3 && <em className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold not-italic text-amber-700">Chỉ còn {p.stock}</em>}
              </div>
              <div className="grid min-w-0 flex-1 content-start gap-1 px-2.5 pb-1.5 pt-2.5 sm:px-3.5 sm:pt-3">
                <b title={showMoney(p.priceAmount, p.priceUnit)} className="truncate text-base font-extrabold text-indigo-700 sm:text-lg">{showMoney(p.priceAmount, p.priceUnit)}</b>
                <strong title={p.title} className="truncate text-[15px] leading-snug">{p.title}</strong>
                <p title={p.description} className="truncate text-[13px] leading-snug text-muted-foreground">{p.description || 'Chưa có mô tả'}</p>
                <small className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><i aria-hidden="true" className={avatarCls}>{String(p.sellerId).slice(-1)}</i><span className="truncate">Người bán #{p.sellerId} · Còn {p.stock}</span></small>
              </div>
              <button type="button" disabled={busy || p.stock === 0 || p.sellerId === userId} onClick={() => updateCart(p.id, 1)}
                className="mx-2.5 mb-2.5 mt-1.5 min-h-11 cursor-pointer rounded-xl border-0 bg-indigo-600 font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-100 disabled:text-indigo-700 sm:mx-3.5 sm:mb-3.5">
                {p.sellerId === userId ? 'Sản phẩm của bạn' : p.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
              </button>
            </article>)}
          </div>
        </>}

        {!loading && loaded && view === 'cart' && <div className="mx-auto grid max-w-3xl gap-3.5">
          {basketSellers.length === 0 && <p className={emptyCls}><ShoppingCart size={32} aria-hidden="true"/>Giỏ hàng đang trống.</p>}
          {basketSellers.map(sellerId => {
            const items = cart.filter(item => item.sellerId === sellerId)
            const units = new Set(items.map(item => item.priceUnit))
            const valid = units.size === 1 && items.every(item => item.status === 'published' && item.quantity <= item.stock)
            const total = items.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0)
            return <article key={sellerId} className={panelCls}>
              <h3 className="flex items-center gap-2 text-base"><i aria-hidden="true" className={avatarCls}>{String(sellerId).slice(-1)}</i>Người bán #{sellerId}</h3>
              {items.map(item => <div key={item.id} className={rowCls}>
                <div className="grid min-w-0 gap-1"><strong>{item.title}</strong><small className="text-muted-foreground">{showMoney(item.priceAmount, item.priceUnit)} · Còn {item.stock}</small></div>
                <div className="flex items-center gap-1 rounded-full bg-indigo-50 p-[3px]">
                  <button disabled={busy} type="button" aria-label={`Giảm số lượng ${item.title}`} onClick={() => updateCart(item.id, item.quantity - 1)} className={stepCls}>−</button>
                  <span className="min-w-7 text-center font-bold">{item.quantity}</span>
                  <button disabled={busy || item.quantity >= item.stock || item.quantity >= 99} type="button" aria-label={`Tăng số lượng ${item.title}`} onClick={() => updateCart(item.id, item.quantity + 1)} className={stepCls}>＋</button>
                </div>
              </div>)}
              {valid ? <p className="flex items-center justify-between text-sm">Tạm tính <b className="text-lg text-indigo-700">{showMoney(total, items[0].priceUnit)}</b></p>
                : <p role="alert" className={noticeCls + ' bg-red-50 text-red-800'}>Các mặt hàng không cùng đơn vị giá hoặc không đủ tồn kho.</p>}
              <button disabled={busy || !valid} type="button" onClick={() => checkout(sellerId)} className={primaryCls}>Lưu yêu cầu đặt hàng (chưa thanh toán)</button>
            </article>
          })}
        </div>}

        {!loading && loaded && view === 'orders' && <div className="mx-auto grid max-w-3xl gap-3.5">
          {orders.length === 0 && <p className={emptyCls}><ClipboardList size={32} aria-hidden="true"/>Bạn chưa tạo yêu cầu đơn hàng.</p>}
          {orders.map(order => <article key={order.id} className={panelCls}>
            <div className="flex items-center justify-between gap-2">
              <strong>Yêu cầu #{order.id}</strong>
              <em className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold not-italic text-orange-800">Chờ thanh toán</em>
            </div>
            <b className="text-lg font-extrabold text-indigo-700">{showMoney(order.amountTotal, order.priceUnit)}</b>
            <small className="text-muted-foreground">Người bán #{order.sellerId}</small>
            <p className="text-[13px] text-muted-foreground">Chờ cấu hình phương thức thanh toán. Chưa trả tiền hoặc đặt đơn thật.</p>
          </article>)}
        </div>}

        {!loading && loaded && view === 'sell' && <section className={panelCls + ' mx-auto max-w-3xl'}>
          <p className="text-[13px] text-muted-foreground"><strong>Trợ lý AI đăng bán sẽ được tích hợp ở bước tiếp theo.</strong> Đây là biểu mẫu dự phòng để tạo bản nháp, chưa phải AI.</p>
          <form onSubmit={createDraft} className="grid gap-3 [&_label]:grid [&_label]:content-start [&_label]:gap-1.5 [&_label]:text-[13px] [&_label]:font-semibold [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:font-[inherit] [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border [&_textarea]:bg-card [&_textarea]:p-3 [&_textarea]:font-[inherit]">
            <label>Tên sản phẩm<input required minLength={2} maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label>
            <label>Mô tả<textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label>Giá niêm yết<input type="number" min={1} required step={1} value={price} onChange={event => setPrice(event.target.value)}/></label>
              <label>Đơn vị giá hiển thị — không phải phương thức thanh toán<input required maxLength={16} value={unit} onChange={event => setUnit(event.target.value)}/></label>
              <label>Số lượng<input type="number" min={0} max={1000000} required step={1} value={stock} onChange={event => setStock(event.target.value)}/></label>
            </div>
            <button type="submit" disabled={busy} className={primaryCls}>Tạo bản nháp</button>
          </form>
          <h3 className="mt-1.5 text-base">Danh sách sản phẩm của tôi</h3>
          {mine.map(p => <div key={p.id} className={rowCls}>
            <div className="grid gap-1"><strong>{p.title}</strong><em className={cn('w-fit rounded-full px-2.5 py-0.5 text-xs font-bold not-italic', p.status === 'draft' ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800')}>{p.status === 'draft' ? 'Bản nháp' : 'Đã đăng'}</em></div>
            {p.status === 'draft' && <button type="button" disabled={busy} onClick={() => publish(p.id)} className="min-h-10 cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 font-semibold text-indigo-800">Xác nhận đăng bán</button>}
          </div>)}
        </section>}
      </div>
      </div>
    </section>
  )
}
