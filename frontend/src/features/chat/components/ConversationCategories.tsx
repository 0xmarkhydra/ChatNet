import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useId, useRef, useState } from 'react'
import { Tag, Pencil, Trash2, Plus, X, ChevronDown, SlidersHorizontal, Layers, Check, LockKeyhole } from 'lucide-react'
import type { ConversationCategory, useConversationCategories } from '../hooks/useConversationCategories'
import '../styles/conversation-categories.css'

type Model = ReturnType<typeof useConversationCategories>
export const categoryColors = [{value:'indigo',name:'Chàm'}, {value:'blue',name:'Xanh dương'}, {value:'green',name:'Xanh lá'}, {value:'orange',name:'Cam'}, {value:'pink',name:'Hồng'}, {value:'slate',name:'Xám'}]

export function CategoryBadge({ category, iconOnly = false, plain = false }: { category?: ConversationCategory; iconOnly?: boolean; plain?: boolean }) {
 return category ? <small className={'conversation-category-badge category-' + category.color + (iconOnly ? ' category-icon-only' : '') + (plain ? ' category-plain' : '')}
  title={category.name} aria-label={iconOnly ? 'Phân loại: '+category.name : undefined}>
  <Tag size={iconOnly ? 14 : 11} fill={iconOnly || plain ? 'currentColor' : 'none'} aria-hidden="true" />{!iconOnly && category.name}
 </small> : null
}
export function CategoryAssignment({ model, conversationId, categoryId }: { model: Model; conversationId: number; categoryId?: number }) {
  const trUi = useUiTranslation()

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
  <button ref={trigger} type="button" aria-label={trUi("chat.categories")} title={label} data-category-id={categoryId || ''}
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
   <div className="category-popover-heading"><strong>{trUi("chat.categories")}</strong></div>
   <fieldset className="category-options">
    <legend className="sr-only">{trUi("chat.selectCategory")}</legend>
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
  const trUi = useUiTranslation()

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
 return <section className="conversation-categories" aria-label={trUi("common.ui.chatCategories")}>
  <div className="category-toolbar">
   <button ref={trigger} type="button" className={'category-filter-trigger' + (model.selected !== null ? ' is-filtered category-' + (selectedCategory?.color || 'slate') : '')}
    aria-label={trUi("chat.filterCategories")} aria-expanded={expanded} popoverTarget={menuId}
    onClick={() => {
     const rect=trigger.current!.getBoundingClientRect()
     const node=menu.current!
     node.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-300))+'px'
     node.style.top=Math.min(rect.bottom+8,window.innerHeight-180)+'px'
     node.style.maxHeight=Math.max(140,window.innerHeight-rect.bottom-20)+'px'
    }}>
    <Tag className="category-filter-tag-icon" size={16} fill={selectedCategory ? 'currentColor' : 'none'} aria-hidden="true" />
    <span>{model.selected === null ? trUi("chat.category") : model.selected === 0 ? trUi("chat.uncategorized") : selectedCategory?.name || trUi("chat.category")}</span>
    <ChevronDown size={15} className={expanded ? 'is-open' : ''} aria-hidden="true" />
   </button>
   {model.selected !== null && <button className="category-clear" type="button" aria-label={trUi("chat.clearCategory")} onClick={() => model.select(null)}><X size={15} /></button>}
  </div>
  <div ref={menu} id={menuId} popover="auto" className="category-popover" onToggle={event => setExpanded(event.newState === 'open')}>
   <div className="category-popover-heading"><strong>{trUi("chat.filterTag")}</strong><span>Tìm nhanh những cuộc trò chuyện của bạn</span></div>
   <fieldset className="category-options">
    <legend className="sr-only">{trUi("chat.filterCategories")}</legend>
    {[{id:null,name:'Tất cả hội thoại',color:'slate'},{id:0,name:'Chưa phân loại',color:'slate'},...model.categories].map(c =>
     <label className={'category-option category-' + c.color + (model.selected === c.id ? ' is-selected' : '')} key={c.id ?? 'all'}>
      <input type="radio" name={menuId} checked={model.selected === c.id} value={c.id ?? 'all'} onChange={() => {model.select(c.id);closeMenu()}} />
      <span className="category-option-icon">{c.id === null ? <Layers size={18} /> : <Tag size={18} fill={c.id ? 'currentColor' : 'none'} />}</span>
      <span>{c.name}</span><Check className="category-option-check" size={17} aria-hidden="true" />
     </label>)}
    {model.categories.length === 0 && <p className="category-no-tags">Tạo thẻ như Gia đình, Công việc để sắp xếp trò chuyện.</p>}
   </fieldset>
   <button type="button" className="category-popover-manage" onClick={openManager}><SlidersHorizontal size={16} />{trUi("chat.manageCategories")}<ChevronDown size={15} /></button>
  </div>
  <dialog ref={manager} className="category-manager" aria-labelledby={menuId+'-title'}
   onCancel={event => {if(model.busy)event.preventDefault()}}
   onClick={event => {if(event.target===manager.current && !model.busy)manager.current?.close()}}>
   <div className="category-dialog-header"><div><span className="category-eyebrow">SẮP XẾP THEO CÁCH CỦA BẠN</span><h2 id={menuId+'-title'}>{trUi("chat.categoryTag")}</h2></div>
    <button type="button" aria-label={trUi("chat.closeTags")} disabled={model.busy} onClick={() => manager.current?.close()}><X size={20} /></button>
   </div>
   <div className="category-manager-content">
    <p className="category-private-note"><LockKeyhole size={15} />Chỉ bạn nhìn thấy các thẻ này.</p>
    <div className="category-managed-heading"><strong>{trUi("chat.yourTags")}</strong><span>{model.categories.length}/50</span></div>
    {model.categories.length === 0 && <p className="category-no-tags">Chưa có thẻ nào. Thêm thẻ đầu tiên bên dưới nhé.</p>}
    <div className="category-managed-list">
    {model.categories.map(c => <div className="category-manager-row" key={c.id}>
     <CategoryBadge category={c} />
     <button type="button" aria-label={'Sửa phân loại ' + c.name} title={trUi("chat.editTag")} disabled={model.busy}
      onClick={() => { setEdit(c.id); setName(c.name); setColor(c.color); setConfirm(null); requestAnimationFrame(()=>manager.current?.querySelector<HTMLInputElement>('input')?.focus()) }}><Pencil size={15} /></button>
     <button type="button" className="category-delete" aria-label={'Xóa phân loại ' + c.name} title={trUi("chat.deleteTag")} disabled={model.busy} onClick={() => setConfirm(c.id)}><Trash2 size={15} /></button>
     {confirm === c.id && <div className="category-delete-confirm" role="alert">
      <span>Xóa thẻ “{c.name}”? Hội thoại vẫn được giữ lại.</span>
      <button type="button" disabled={model.busy} onClick={async () => { if (await model.remove(c.id)) reset() }}>{trUi("common.deleteConfirm")}</button>
      <button type="button" disabled={model.busy} onClick={() => setConfirm(null)}>{trUi("common.keep")}</button>
     </div>}
    </div>)}
    </div>
    <form onSubmit={async e => {e.preventDefault(); if (await model.save({name:name.trim(),color},edit)) reset()}}>
     <strong>{edit ? trUi("chat.editCategory") : trUi("chat.newTag")}</strong>
     <label>{trUi("chat.tagName")}<input aria-label={trUi("chat.categoryName")} value={name} onChange={e => setName(e.target.value)} maxLength={40} required disabled={model.busy} placeholder={trUi("common.ui.categoryExample")} /></label>
     <fieldset className="category-color-picker"><legend>{trUi("chat.tagColor")}</legend>
      {categoryColors.map(c => <label key={c.value} className={'category-color-choice category-'+c.value} title={c.name}>
       <input type="radio" name={menuId+'-color'} aria-label={'Màu '+c.name} value={c.value} checked={color===c.value} disabled={model.busy} onChange={() => setColor(c.value)} />
       <span><Check size={17} /></span>
      </label>)}
     </fieldset>
     <div className="category-form-actions">
      <CategoryBadge category={{id:edit||0,name:name.trim()||'Tên thẻ',color}} />
      {edit && <button type="button" disabled={model.busy} onClick={reset}>{trUi("common.cancel")}</button>}
      <button type="submit" disabled={model.busy || !name.trim() || (!edit && model.categories.length >= 50)}><Plus size={16} />{edit ? trUi("common.saveChanges") : 'Thêm thẻ'}</button>
     </div>
    </form>
    {model.error && <div className="category-error" role="alert">{model.error}<button type="button" disabled={model.busy} onClick={() => void model.refreshCategories(true)}>{trUi("chat.reloadTags")}</button></div>}
   </div>
  </dialog>
  {model.error && <div className="category-error" role="alert">{model.error}<button type="button" disabled={model.busy} onClick={() => void model.refreshCategories(true)}>{trUi("chat.reloadTags")}</button></div>}
 </section>
}