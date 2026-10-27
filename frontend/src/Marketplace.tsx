import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ShoppingBag, ShoppingCart, ClipboardList } from 'lucide-react'
import './marketplace.css'

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
  request: (path: string, init?: RequestInit) => Promise<Response>
  onBack: () => void
}
const showMoney = (n: number, unit: string) => n.toLocaleString('vi-VN') + ' ' + unit

export default function Marketplace({ userId, request, onBack }: Props) {
  const apiRef = useRef(request)
  apiRef.current = request
  const [view, setView] = useState<'products' | 'cart' | 'orders' | 'sell'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [mine, setMine] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('')
  const [stock, setStock] = useState('1')

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiRef.current(path, init)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(typeof body?.error === 'string' ? body.error : 'Yêu cầu không thành công')
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
  async function refresh() {
    try {
      const [catalog, basket, history, owned] = await Promise.all([
        api<{ products: Product[] }>('/api/marketplace/products'),
        api<{ items: CartItem[] }>('/api/marketplace/cart'),
        api<{ orders: Order[] }>('/api/marketplace/orders'),
        api<{ products: Product[] }>('/api/marketplace/products/mine'),
      ])
      setProducts(catalog.products)
      setCart(basket.items)
      setOrders(history.orders)
      setMine(owned.products)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được sàn')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [userId])

  async function execute(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setMessage('')
    setError('')
    try { await fn(); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể thực hiện') }
    finally { setBusy(false) }
  }
  const basketSellers = Array.from(new Set(cart.map(item => item.sellerId)))
  function updateCart(productId: number, quantity: number) {
    void execute(async () => {
      if (quantity <= 0) {
        await api<void>('/api/marketplace/cart/' + productId, { method: 'DELETE' })
      } else {
        await api<void>('/api/marketplace/cart/' + productId, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
        })
      }
      setMessage('Đã cập nhật giỏ hàng.')
    })
  }
  function checkout(sellerId: number) {
    void execute(async () => {
      const order = await api<{ id: number }>('/api/marketplace/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, idempotencyKey: crypto.randomUUID().replaceAll('-', '') }),
      })
      setView('orders')
      setMessage('Đã lưu yêu cầu #' + order.id + ' để kiểm thử. Chưa thu tiền, giữ hàng hoặc gửi đơn cho người bán.')
    })
  }
  function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void execute(async () => {
      await api('/api/marketplace/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), priceAmount: Number(price),
          priceUnit: unit.toUpperCase().trim(), stock: Number(stock),
        }),
      })
      setTitle(''); setDescription(''); setPrice(''); setUnit(''); setStock('1')
      setMessage('Đã lưu bản nháp. Bạn cần xác nhận trước khi đăng.')
    })
  }
  function publish(productId: number) {
    void execute(async () => {
      await api('/api/marketplace/products/' + productId + '/publish', { method: 'POST' })
      setMessage('Đã đăng sản phẩm.')
    })
  }
  return (
    <section className="marketplace-view">
      <header className="marketplace-header">
        <button type="button" aria-label="Quay lại Khám phá" onClick={onBack}><ArrowLeft size={20}/></button>
        <h2>SOCO Market</h2>
        <span>Sàn mua bán trên ChatNet</span>
      </header>
      <nav className="marketplace-tabs" aria-label="Sàn mua bán">
        <button type="button" className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}><ShoppingBag size={17}/> Sản phẩm</button>
        <button type="button" className={view === 'cart' ? 'active' : ''} onClick={() => setView('cart')}><ShoppingCart size={17}/> Giỏ ({cart.length})</button>
        <button type="button" className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}><ClipboardList size={17}/> Đơn hàng</button>
        <button type="button" className={view === 'sell' ? 'active' : ''} onClick={() => setView('sell')}>+ Bán hàng</button>
      </nav>
      <div className="marketplace-body">
        <p className="marketplace-warning" role="note">Chưa cấu hình phương thức thanh toán. Không thu tiền hoặc đặt đơn thật; chức năng đơn hiện dùng để kiểm thử.</p>
        {loading && <p role="status">Đang tải dữ liệu sàn...</p>}
        {error && <p role="alert" className="marketplace-error">{error} <button onClick={() => void refresh()} type="button">Thử lại</button></p>}
        {message && <p role="status" className="marketplace-message">{message}</p>}

        {!loading && view === 'products' && <div className="marketplace-grid">
          {products.length === 0 && <p>Chưa có sản phẩm được đăng.</p>}
          {products.map(p => <article className="marketplace-card" key={p.id}>
            <div className="marketplace-image"><ShoppingBag size={36}/></div>
            <strong>{p.title}</strong>
            <p>{p.description || 'Chưa có mô tả'}</p>
            <b>{showMoney(p.priceAmount, p.priceUnit)}</b>
            <small>Còn {p.stock}</small>
            <button type="button" disabled={busy || p.stock === 0 || p.sellerId === userId}
              onClick={() => updateCart(p.id, 1)}>
              {p.sellerId === userId ? 'Sản phẩm của bạn' : p.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          </article>)}
        </div>}

        {!loading && view === 'cart' && <div className="marketplace-list">
          {basketSellers.length === 0 && <p>Giỏ hàng đang trống.</p>}
          {basketSellers.map(sellerId => {
            const items = cart.filter(item => item.sellerId === sellerId)
            const units = new Set(items.map(item => item.priceUnit))
            const valid = units.size === 1 && items.every(item => item.status === 'published' && item.quantity <= item.stock)
            const total = items.reduce((sum, item) => sum + item.priceAmount * item.quantity, 0)
            return <article className="marketplace-basket" key={sellerId}>
              <h3>Người bán #{sellerId}</h3>
              {items.map(item => <div className="marketplace-row" key={item.id}>
                <div><strong>{item.title}</strong><small>{showMoney(item.priceAmount, item.priceUnit)} · Còn {item.stock}</small></div>
                <div>
                  <button disabled={busy} type="button" onClick={() => updateCart(item.id, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button disabled={busy || item.quantity >= item.stock || item.quantity >= 99} type="button" onClick={() => updateCart(item.id, item.quantity + 1)}>＋</button>
                </div>
              </div>)}
              {valid ? <p>Tạm tính: <b>{showMoney(total, items[0].priceUnit)}</b></p>
                : <p role="alert">Các mặt hàng không cùng đơn vị giá hoặc không đủ tồn kho.</p>}
              <button className="marketplace-primary" disabled={busy || !valid} type="button"
                onClick={() => checkout(sellerId)}>Lưu yêu cầu đặt hàng (chưa thanh toán)</button>
            </article>
          })}
        </div>}

        {!loading && view === 'orders' && <div className="marketplace-list">
          {orders.length === 0 && <p>Bạn chưa tạo yêu cầu đơn hàng.</p>}
          {orders.map(order => <article className="marketplace-basket" key={order.id}>
            <strong>Yêu cầu #{order.id}</strong>
            <b>{showMoney(order.amountTotal, order.priceUnit)}</b>
            <small>Người bán #{order.sellerId}</small>
            <p>Chờ cấu hình phương thức thanh toán. Chưa trả tiền hoặc đặt đơn thật.</p>
          </article>)}
        </div>}

        {!loading && view === 'sell' && <section className="marketplace-sell">
          <p><strong>Trợ lý AI đăng bán sẽ được tích hợp ở bước tiếp theo.</strong> Đây là biểu mẫu dự phòng để tạo bản nháp, chưa phải AI.</p>
          <form onSubmit={createDraft}>
            <label>Tên sản phẩm<input required minLength={2} maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label>
            <label>Mô tả<textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
            <label>Giá niêm yết<input type="number" min={1} required step={1} value={price} onChange={event => setPrice(event.target.value)}/></label>
            <label>Đơn vị giá hiển thị — không phải phương thức thanh toán<input required maxLength={16} value={unit} onChange={event => setUnit(event.target.value)}/></label>
            <label>Số lượng<input type="number" min={0} max={1000000} required step={1} value={stock} onChange={event => setStock(event.target.value)}/></label>
            <button type="submit" className="marketplace-primary" disabled={busy}>Tạo bản nháp</button>
          </form>
          <h3>Danh sách sản phẩm của tôi</h3>
          {mine.map(p => <div className="marketplace-row" key={p.id}>
            <div><strong>{p.title}</strong><small>{p.status === 'draft' ? 'Bản nháp' : 'Đã đăng'}</small></div>
            {p.status === 'draft' && <button type="button" disabled={busy} onClick={() => publish(p.id)}>Xác nhận đăng bán</button>}
          </div>)}
        </section>}
      </div>
    </section>
  )
}
