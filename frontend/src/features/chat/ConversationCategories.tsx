import { useState } from 'react'
import { Tag, Pencil, Trash2, Plus, X } from 'lucide-react'
import type { ConversationCategory, useConversationCategories } from './useConversationCategories'
import './conversation-categories.css'

type Model = ReturnType<typeof useConversationCategories>
export const categoryColors = [{value:'indigo',name:'Chàm'}, {value:'blue',name:'Xanh dương'}, {value:'green',name:'Xanh lá'}, {value:'orange',name:'Cam'}, {value:'pink',name:'Hồng'}, {value:'slate',name:'Xám'}]

export function CategoryBadge({ category }: { category?: ConversationCategory }) {
 return category ? <small className={'conversation-category-badge category-' + category.color}><Tag size={11} aria-hidden="true" />{category.name}</small> : null
}
export function CategoryAssignment({ model, conversationId, categoryId }: { model: Model; conversationId: number; categoryId?: number }) {
 return <div className="conversation-category-assignment">
  <Tag size={15} aria-hidden="true" />
  <label>Phân loại
   <select aria-label="Phân loại hội thoại" value={categoryId || ''} disabled={model.busy}
    onChange={e => void model.assign(conversationId, Number(e.target.value) || null)}>
    <option value="">Chưa phân loại</option>
    {model.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
   </select>
  </label>
  {model.error && <span role="alert">{model.error}</span>}
 </div>
}
export default function ConversationCategories({ model }: { model: Model }) {
 const [edit, setEdit] = useState<number | undefined>()
 const [name, setName] = useState('')
 const [color, setColor] = useState('indigo')
 const [confirm, setConfirm] = useState<number | null>(null)
 const reset = () => { setEdit(undefined); setName(''); setColor('indigo'); setConfirm(null) }
 return <section className="conversation-categories" aria-label="Phân loại trò chuyện">
  <label className="category-filter"><Tag size={16} aria-hidden="true" /><span className="sr-only">Lọc hội thoại theo phân loại</span>
   <select aria-label="Lọc hội thoại theo phân loại" value={model.selected === null ? 'all' : model.selected}
    onChange={e => model.select(e.target.value === 'all' ? null : Number(e.target.value))}>
    <option value="all">Tất cả hội thoại</option>
    <option value="0">Chưa phân loại</option>
    {model.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
   </select>
  </label>
  <details className="category-manager">
   <summary><Tag size={14} aria-hidden="true" />Quản lý thẻ</summary>
   <div className="category-manager-content">
    <p>Thẻ chỉ hiển thị với bạn. Mỗi hội thoại thuộc một phân loại.</p>
    {model.categories.map(c => <div className="category-manager-row" key={c.id}>
     <CategoryBadge category={c} />
     <button type="button" aria-label={'Sửa phân loại ' + c.name} disabled={model.busy}
      onClick={() => { setEdit(c.id); setName(c.name); setColor(c.color); setConfirm(null) }}><Pencil size={15} /></button>
     <button type="button" aria-label={'Xóa phân loại ' + c.name} disabled={model.busy} onClick={() => setConfirm(c.id)}><Trash2 size={15} /></button>
     {confirm === c.id && <div className="category-delete-confirm">
      <span>Xóa thẻ “{c.name}”? Hội thoại vẫn được giữ lại.</span>
      <button type="button" disabled={model.busy} onClick={async () => { if (await model.remove(c.id)) reset() }}>Xác nhận xóa</button>
      <button type="button" disabled={model.busy} onClick={() => setConfirm(null)}>Giữ lại</button>
     </div>}
    </div>)}
    <form onSubmit={async e => {e.preventDefault(); if (await model.save({name:name.trim(),color},edit)) reset()}}>
     <strong>{edit ? 'Sửa phân loại' : 'Thêm phân loại'}</strong>
     <label>Tên thẻ<input aria-label="Tên phân loại" value={name} onChange={e => setName(e.target.value)} maxLength={40} required disabled={model.busy} placeholder="Ví dụ: Gia đình" /></label>
     <label>Màu thẻ<select aria-label="Màu phân loại" value={color} onChange={e => setColor(e.target.value)} disabled={model.busy}>
      {categoryColors.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
     </select></label>
     <div className="category-form-actions">
      <button type="submit" disabled={model.busy || !name.trim() || (!edit && model.categories.length >= 50)}><Plus size={15} />{model.busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Thêm thẻ'}</button>
      {edit && <button type="button" disabled={model.busy} onClick={reset}><X size={15} />Hủy</button>}
     </div>
    </form>
   </div>
  </details>
  {model.error && <div className="category-error" role="alert">{model.error}<button type="button" disabled={model.busy} onClick={() => void model.refreshCategories(true)}>Tải lại thẻ</button></div>}
 </section>
}
