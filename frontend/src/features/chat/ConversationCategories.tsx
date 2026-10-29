import { useEffect, useId, useRef, useState } from 'react'
import { Tag, Pencil, Trash2, Plus, X, ChevronDown, SlidersHorizontal, Layers, Check, LockKeyhole } from 'lucide-react'
import type { ConversationCategory, useConversationCategories } from './useConversationCategories'
import './conversation-categories.css'

type Model = ReturnType<typeof useConversationCategories>
export const categoryColors = [{value:'indigo',name:'Chàm'}, {value:'blue',name:'Xanh dương'}, {value:'green',name:'Xanh lá'}, {value:'orange',name:'Cam'}, {value:'pink',name:'Hồng'}, {value:'slate',name:'Xám'}]

export function CategoryBadge({ category, iconOnly = false }: { category?: ConversationCategory; iconOnly?: boolean }) {
 return category ? <small className={'conversation-category-badge category-' + category.color + (iconOnly ? ' category-icon-only' : '')}
  title={category.name} aria-label={iconOnly ? 'Phân loại: '+category.name : undefined}>
  <Tag size={iconOnly ? 14 : 11} fill={iconOnly ? 'currentColor' : 'none'} aria-hidden="true" />{!iconOnly && category.name}
 </small> : null
}
export function CategoryAssignment({ model, conversationId, categoryId }: { model: Model; conversationId: number; categoryId?: number }) {
 const category = model.categories.find(c => c.id === categoryId)
 const label = category ? 'Phân loại: '+category.name : 'Phân loại hội thoại'
 const menuId = useId()
 const menu = useRef<HTMLDivElement>(null)
 const trigger = useRef<HTMLButtonElement>(null)
 const [expanded,setExpanded] = useState(false)
 useEffect(() => { menu.current?.hidePopover() },[conversationId])
 useEffect(() => {
  if (!expanded) return
  const close = () => menu.current?.hidePopover()
  const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close() }
  window.addEventListener('resize',close)
  document.addEventListener('scroll',scroll,true)
  return () => {window.removeEventListener('resize',close);document.removeEventListener('scroll',scroll,true)}
 },[expanded])
 return <span className={'conversation-category-assignment'+(category ? ' category-'+category.color : '')}>
  <button ref={trigger} type="button" aria-label="Phân loại hội thoại" title={label} data-category-id={categoryId || ''}
   disabled={model.busy} aria-expanded={expanded} popoverTarget={menuId}
   onClick={() => {
    const rect=trigger.current!.getBoundingClientRect()
    const node=menu.current!
    node.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-300))+'px'
    node.style.top=Math.min(rect.bottom+8,window.innerHeight-180)+'px'
    node.style.maxHeight=Math.max(140,window.innerHeight-rect.bottom-20)+'px'
   }}>
   <Tag size={17} aria-hidden="true" fill={category ? 'currentColor' : 'none'} />
  </button>
  <div ref={menu} id={menuId} popover="auto" className="category-popover category-assignment-popover"
   onToggle={event => setExpanded(event.newState === 'open')}>
   <div className="category-popover-heading"><strong>Phân loại hội thoại</strong></div>
   <fieldset className="category-options">
    <legend className="sr-only">Chọn thẻ cho hội thoại</legend>
    {[{id:0,name:'Chưa phân loại',color:'slate'},...model.categories].map(c =>
     <label className={'category-option category-'+c.color+((categoryId || 0)===c.id ? ' is-selected' : '')} key={c.id}>
      <input type="radio" name={menuId} value={c.id} checked={(categoryId || 0)===c.id} disabled={model.busy}
       onChange={() => {menu.current?.hidePopover();trigger.current?.focus();void model.assign(conversationId,c.id || null)}} />
      <span className="category-option-icon"><Tag size={18} fill={c.id ? 'currentColor' : 'none'} /></span>
      <span>{c.name}</span><Check className="category-option-check" size={17} aria-hidden="true" />
     </label>)}
   </fieldset>
  </div>
  {model.error && <span className="category-assignment-error" role="alert">{model.error}</span>}
 </span>
}

export default function ConversationCategories({ model }: { model: Model }) {
 const [edit, setEdit] = useState<number | undefined>()
 const [name, setName] = useState('')
 const [color, setColor] = useState('indigo')
 const [confirm, setConfirm] = useState<number | null>(null)
 const reset = () => { setEdit(undefined); setName(''); setColor('indigo'); setConfirm(null) }
 const menuId = useId()
 const menu = useRef<HTMLDivElement>(null)
 const trigger = useRef<HTMLButtonElement>(null)
 const manager = useRef<HTMLDialogElement>(null)
 const [expanded,setExpanded] = useState(false)
 const selectedCategory = model.categories.find(c => c.id === model.selected)
 const closeMenu = () => { menu.current?.hidePopover(); trigger.current?.focus() }
 const openManager = () => { menu.current?.hidePopover(); manager.current?.showModal() }
 useEffect(() => {
  if (!expanded) return
  const close = () => menu.current?.hidePopover()
  const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close() }
  window.addEventListener('resize',close)
  document.addEventListener('scroll',scroll,true)
  return () => { window.removeEventListener('resize',close); document.removeEventListener('scroll',scroll,true) }
 },[expanded])
 return <section className="conversation-categories" aria-label="Phân loại trò chuyện">
  <div className="category-toolbar">
   <button ref={trigger} type="button" className={'category-filter-trigger' + (model.selected !== null ? ' is-filtered' : '')}
    aria-label="Lọc hội thoại theo phân loại" aria-expanded={expanded} popoverTarget={menuId}
    onClick={() => {
     const rect=trigger.current!.getBoundingClientRect()
     const node=menu.current!
     node.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-300))+'px'
     node.style.top=Math.min(rect.bottom+8,window.innerHeight-180)+'px'
     node.style.maxHeight=Math.max(140,window.innerHeight-rect.bottom-20)+'px'
    }}>
    <Tag size={16} aria-hidden="true" /><span>{model.selected === null ? 'Phân loại' : model.selected === 0 ? 'Chưa phân loại' : selectedCategory?.name || 'Phân loại'}</span>
    <ChevronDown size={15} className={expanded ? 'is-open' : ''} aria-hidden="true" />
   </button>
   {model.selected !== null && <button className="category-clear" type="button" aria-label="Xóa bộ lọc phân loại" onClick={() => model.select(null)}><X size={15} /></button>}
   <button className="category-manage-trigger" type="button" aria-label="Quản lý thẻ phân loại" title="Quản lý thẻ phân loại" onClick={openManager}><SlidersHorizontal size={17} /></button>
  </div>
  <div ref={menu} id={menuId} popover="auto" className="category-popover" onToggle={event => setExpanded(event.newState === 'open')}>
   <div className="category-popover-heading"><strong>Lọc theo thẻ</strong><span>Tìm nhanh những cuộc trò chuyện của bạn</span></div>
   <fieldset className="category-options">
    <legend className="sr-only">Lọc hội thoại theo phân loại</legend>
    {[{id:null,name:'Tất cả hội thoại',color:'slate'},{id:0,name:'Chưa phân loại',color:'slate'},...model.categories].map(c =>
     <label className={'category-option category-' + c.color + (model.selected === c.id ? ' is-selected' : '')} key={c.id ?? 'all'}>
      <input type="radio" name={menuId} checked={model.selected === c.id} value={c.id ?? 'all'} onChange={() => {model.select(c.id);closeMenu()}} />
      <span className="category-option-icon">{c.id === null ? <Layers size={18} /> : <Tag size={18} fill={c.id ? 'currentColor' : 'none'} />}</span>
      <span>{c.name}</span><Check className="category-option-check" size={17} aria-hidden="true" />
     </label>)}
    {model.categories.length === 0 && <p className="category-no-tags">Tạo thẻ như Gia đình, Công việc để sắp xếp trò chuyện.</p>}
   </fieldset>
   <button type="button" className="category-popover-manage" onClick={openManager}><SlidersHorizontal size={16} />Quản lý thẻ phân loại<ChevronDown size={15} /></button>
  </div>
  <dialog ref={manager} className="category-manager" aria-labelledby={menuId+'-title'}
   onCancel={event => {if(model.busy)event.preventDefault()}}
   onClick={event => {if(event.target===manager.current && !model.busy)manager.current?.close()}}>
   <div className="category-dialog-header"><div><span className="category-eyebrow">SẮP XẾP THEO CÁCH CỦA BẠN</span><h2 id={menuId+'-title'}>Thẻ phân loại</h2></div>
    <button type="button" aria-label="Đóng quản lý thẻ" disabled={model.busy} onClick={() => manager.current?.close()}><X size={20} /></button>
   </div>
   <div className="category-manager-content">
    <p className="category-private-note"><LockKeyhole size={15} />Chỉ bạn nhìn thấy các thẻ này.</p>
    <div className="category-managed-heading"><strong>Thẻ của bạn</strong><span>{model.categories.length}/50</span></div>
    {model.categories.length === 0 && <p className="category-no-tags">Chưa có thẻ nào. Thêm thẻ đầu tiên bên dưới nhé.</p>}
    <div className="category-managed-list">
    {model.categories.map(c => <div className="category-manager-row" key={c.id}>
     <CategoryBadge category={c} />
     <button type="button" aria-label={'Sửa phân loại ' + c.name} title="Sửa thẻ" disabled={model.busy}
      onClick={() => { setEdit(c.id); setName(c.name); setColor(c.color); setConfirm(null); requestAnimationFrame(()=>manager.current?.querySelector<HTMLInputElement>('input')?.focus()) }}><Pencil size={15} /></button>
     <button type="button" className="category-delete" aria-label={'Xóa phân loại ' + c.name} title="Xóa thẻ" disabled={model.busy} onClick={() => setConfirm(c.id)}><Trash2 size={15} /></button>
     {confirm === c.id && <div className="category-delete-confirm" role="alert">
      <span>Xóa thẻ “{c.name}”? Hội thoại vẫn được giữ lại.</span>
      <button type="button" disabled={model.busy} onClick={async () => { if (await model.remove(c.id)) reset() }}>Xác nhận xóa</button>
      <button type="button" disabled={model.busy} onClick={() => setConfirm(null)}>Giữ lại</button>
     </div>}
    </div>)}
    </div>
    <form onSubmit={async e => {e.preventDefault(); if (await model.save({name:name.trim(),color},edit)) reset()}}>
     <strong>{edit ? 'Chỉnh sửa thẻ' : 'Tạo thẻ mới'}</strong>
     <label>Tên thẻ<input aria-label="Tên phân loại" value={name} onChange={e => setName(e.target.value)} maxLength={40} required disabled={model.busy} placeholder="Ví dụ: Gia đình, Công việc…" /></label>
     <fieldset className="category-color-picker"><legend>Màu thẻ</legend>
      {categoryColors.map(c => <label key={c.value} className={'category-color-choice category-'+c.value} title={c.name}>
       <input type="radio" name={menuId+'-color'} aria-label={'Màu '+c.name} value={c.value} checked={color===c.value} disabled={model.busy} onChange={() => setColor(c.value)} />
       <span><Check size={17} /></span>
      </label>)}
     </fieldset>
     <div className="category-form-actions">
      <CategoryBadge category={{id:edit||0,name:name.trim()||'Tên thẻ',color}} />
      {edit && <button type="button" disabled={model.busy} onClick={reset}>Hủy</button>}
      <button type="submit" disabled={model.busy || !name.trim() || (!edit && model.categories.length >= 50)}><Plus size={16} />{model.busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Thêm thẻ'}</button>
     </div>
    </form>
    {model.error && <div className="category-error" role="alert">{model.error}<button type="button" disabled={model.busy} onClick={() => void model.refreshCategories(true)}>Tải lại thẻ</button></div>}
   </div>
  </dialog>
  {model.error && <div className="category-error" role="alert">{model.error}<button type="button" disabled={model.busy} onClick={() => void model.refreshCategories(true)}>Tải lại thẻ</button></div>}
 </section>
}