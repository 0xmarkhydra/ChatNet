import type { Dispatch, SetStateAction } from 'react'
import { Check, Search, UserRoundPlus, X } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'

export type TaggedFriend = { id: number; username: string; displayName: string }
const MAX_TAGGED_FRIENDS = 10

export default function PostTagPicker({
  tagPickerOpen, tagQuery, setTagQuery, taggableFriends, taggedFriends, setTaggedFriends, disabled, onClose,
}: {
  tagPickerOpen: boolean
  tagQuery: string
  setTagQuery: (query: string) => void
  taggableFriends: TaggedFriend[]
  taggedFriends: TaggedFriend[]
  setTaggedFriends: Dispatch<SetStateAction<TaggedFriend[]>>
  disabled: boolean
  onClose: () => void
}) {
  const normalizedQuery = tagQuery.trim().toLocaleLowerCase('vi')
  const matchingFriends = taggableFriends.filter(friend =>
    !normalizedQuery || friend.username.toLocaleLowerCase('vi').includes(normalizedQuery)
      || friend.displayName.toLocaleLowerCase('vi').includes(normalizedQuery)
  ).slice(0, 12)

  return (
    <section className="smart-tag-picker" aria-label="Gắn thẻ bạn bè">
      <div className="smart-tag-picker-heading">
        <strong><UserRoundPlus size={17} aria-hidden="true" /> Gắn thẻ bạn bè</strong>
        <button type="button" aria-label="Đóng chọn bạn bè" disabled={disabled} onClick={onClose}><X size={17} aria-hidden="true" /></button>
      </div>
      {taggedFriends.length > 0 && (
        <div className="smart-tag-selected" aria-label="Bạn bè đã gắn thẻ">
          {taggedFriends.map(friend => (
            <span className="smart-tag-chip" key={friend.id}>
              {friend.displayName || friend.username}
              <button type="button" disabled={disabled} aria-label={`Bỏ gắn thẻ ${friend.displayName || friend.username}`}
                onClick={() => setTaggedFriends(current => current.filter(item => item.id !== friend.id))}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {tagPickerOpen && <>
        <label className="smart-tag-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Tìm bạn bè để gắn thẻ" value={tagQuery}
            onChange={event => setTagQuery(event.target.value)}
            disabled={disabled} placeholder="Tìm theo tên hoặc tài khoản..." />
        </label>
        <div className="smart-tag-results" role="group" aria-label="Danh sách bạn bè">
          {matchingFriends.map(friend => {
            const selected = taggedFriends.some(item => item.id === friend.id)
            return <button key={friend.id} type="button" className="smart-tag-person" aria-pressed={selected}
              disabled={disabled || (!selected && taggedFriends.length >= MAX_TAGGED_FRIENDS)}
              onClick={() => setTaggedFriends(current => current.some(item => item.id === friend.id)
                ? current.filter(item => item.id !== friend.id)
                : current.length >= MAX_TAGGED_FRIENDS ? current : [...current, friend])}>
              <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="smart-tag-avatar" />
              <span><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}</small></span>
              {selected && <Check size={19} aria-hidden="true" className="smart-tag-selected-icon" />}
            </button>
          })}
          {matchingFriends.length === 0 && <p className="smart-tag-empty">
            {taggableFriends.length ? 'Không tìm thấy bạn bè phù hợp.' : 'Danh sách bạn bè đang trống.'}
          </p>}
        </div>
        <small className="smart-tag-hint">Tối đa {MAX_TAGGED_FRIENDS} người. Tên tài khoản được lưu vào nội dung bài viết.</small>
      </>}
    </section>
  )
}
