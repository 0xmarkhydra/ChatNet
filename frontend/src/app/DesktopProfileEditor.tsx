import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowLeft, Camera, Check, Eye, MapPin, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import UserAvatar from '../shared/ui/UserAvatar'
import type { ProfileMediaState, UserPrivacy } from '../features/profile/types'

type Props = {
  profile: ProfileMediaState | null
  username: string
  displayName: string
  coverUrl?: string
  displayNameDraft: string
  setDisplayNameDraft: (value: string) => void
  usernameDraft: string
  setUsernameDraft: (value: string) => void
  bioDraft: string
  setBioDraft: (value: string) => void
  cityDraft: string
  setCityDraft: (value: string) => void
  profileSaving: boolean
  mediaBusy: boolean
  privacy: UserPrivacy | null
  privacyBusy: boolean
  privacyLoading: boolean
  privacyError: string
  retryPrivacy: () => void
  changePrivacy: (key: keyof UserPrivacy) => Promise<void>
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onDiscard: () => void
  onChangeAvatar: () => void
  onChangeCover: () => void
}

const accessRows = [
  { key: 'searchableByUsername', title: 'Tìm bằng tên người dùng', subtitle: 'Cho phép tìm bằng @username' },
  { key: 'searchableByName', title: 'Tìm theo tên hiển thị', subtitle: 'Xuất hiện khi tìm tên của bạn' },
  { key: 'allowFriendRequests', title: 'Lời mời kết bạn', subtitle: 'Cho phép gửi lời mời mới' },
  { key: 'showOnlineStatus', title: 'Trạng thái trực tuyến', subtitle: 'Hiển thị khi đang hoạt động' },
] as const

export default function DesktopProfileEditor({
  profile, username, displayName, coverUrl,
  displayNameDraft, setDisplayNameDraft, usernameDraft, setUsernameDraft,
  bioDraft, setBioDraft, cityDraft, setCityDraft, profileSaving, mediaBusy,
  privacy, privacyBusy, privacyLoading, privacyError, retryPrivacy, changePrivacy,
  onSave, onDiscard, onChangeAvatar, onChangeCover,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  const same = Boolean(profile) &&
    displayNameDraft.trim() === profile?.displayName &&
    usernameDraft.trim().toLowerCase() === profile?.username &&
    bioDraft.trim() === (profile?.bio ?? '') &&
    cityDraft.trim() === (profile?.city ?? '')
  const savingDisabled = !profile || profileSaving || same ||
    !displayNameDraft.trim() || !usernameDraft.trim() ||
    Array.from(bioDraft).length > 160 || Array.from(cityDraft).length > 100

  const editName = displayNameDraft.trim() || profile?.displayName || displayName
  const editUsername = usernameDraft.trim().toLowerCase() || profile?.username || username

  const cover = (preview: boolean) => (
    <div className={preview ? 'penpot-edit-cover penpot-edit-preview-cover' : 'penpot-edit-cover'}>
      {profile?.coverSet && coverUrl && <img src={coverUrl} alt={preview ? '' : 'Ảnh bìa hiện tại'}
        onError={event => { event.currentTarget.hidden = true }} />}
      {!preview && <button type="button" className="penpot-edit-cover-button" onClick={onChangeCover} disabled={mediaBusy} aria-label="Đổi ảnh bìa">
        <Camera size={17} aria-hidden="true" /> Đổi ảnh bìa
      </button>}
    </div>
  )

  return (
    <div className="penpot-edit-page" aria-label="Chỉnh sửa hồ sơ">
      <form className="penpot-edit-form-card" onSubmit={onSave}>
        <div className="penpot-edit-form-heading">
          <button type="button" className="penpot-edit-back" onClick={onDiscard} aria-label="Quay lại hồ sơ" title="Quay lại hồ sơ"><ArrowLeft size={20} aria-hidden="true" /></button>
          <div>
            <h1 ref={heading} tabIndex={-1}>Thông tin cơ bản</h1>
            <p>Chỉ thay đổi những thông tin bạn muốn người khác nhìn thấy.</p>
          </div>
        </div>

        <div className="penpot-edit-cover-slot">{cover(false)}</div>
        <div className="penpot-edit-avatar-ring">
          <UserAvatar username={username} name={displayName} className="penpot-edit-avatar" online />
          <button type="button" className="penpot-edit-avatar-button" disabled={mediaBusy} onClick={onChangeAvatar}
            aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"><Camera size={17} aria-hidden="true" /></button>
        </div>

        <div className="penpot-edit-fields">
          <label className="penpot-edit-field">
            <span>Tên hiển thị</span>
            <input autoComplete="name" type="text" name="displayName" required maxLength={100} disabled={profileSaving}
              value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)}
              placeholder="Nhập tên hiển thị" />
          </label>
          <label className="penpot-edit-field">
            <span>Tên người dùng</span>
            <input autoComplete="username" type="text" name="username" required minLength={3} maxLength={32}
              autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={profileSaving}
              value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.toLowerCase())}
              placeholder="Tên người dùng duy nhất" />
          </label>
          <label className="penpot-edit-field">
            <span>Tiểu sử</span>
            <input type="text" name="bio" maxLength={160} disabled={profileSaving} value={bioDraft}
              onChange={event => setBioDraft(event.target.value)} placeholder="Một chút giới thiệu về bạn" />
          </label>
          <label className="penpot-edit-field">
            <span>Thành phố</span>
            <input type="text" name="city" maxLength={100} disabled={profileSaving} value={cityDraft}
              onChange={event => setCityDraft(event.target.value)} placeholder="Thành phố bạn muốn chia sẻ" />
          </label>
        </div>
        <footer className="penpot-edit-form-footer">
          <span className="penpot-edit-save-hint">Ảnh và quyền hiển thị được cập nhật ngay sau khi thay đổi.</span>
          <button type="button" className="penpot-edit-discard" onClick={onDiscard} disabled={profileSaving}>
            <RotateCcw size={17} aria-hidden="true" /> Hủy thay đổi
          </button>
          <button type="submit" className="penpot-edit-submit" disabled={savingDisabled}>
            {profileSaving ? <span role="status">Đang lưu...</span> : <><Save size={17} aria-hidden="true" /> Lưu hồ sơ</>}
          </button>
        </footer>
      </form>

      <aside className="penpot-edit-side" aria-label="Xem trước và quyền hiển thị">
        <section className="penpot-edit-preview-card" aria-label="Xem trước hồ sơ">
          <h2>Xem trước hồ sơ</h2>
          {cover(true)}
          <div className="penpot-edit-preview-identity">
            <UserAvatar username={username} name={editName} className="penpot-edit-preview-avatar" />
            <div className="penpot-edit-preview-name"><strong>{editName}</strong><span>@{editUsername}</span></div>
          </div>
          <div className="penpot-edit-preview-about">
            <p>{bioDraft.trim() || 'Thêm tiểu sử để mọi người hiểu hơn về bạn.'}</p>
            {cityDraft.trim() && <div><MapPin size={15} aria-hidden="true" /><span>{cityDraft.trim()}</span></div>}
          </div>
          <div className="penpot-edit-preview-message"><Eye size={15} aria-hidden="true" /> Xem trước thông tin đang chỉnh sửa</div>
        </section>

        <section className="penpot-edit-privacy-card" aria-label="Quyền hiển thị">
          <div className="penpot-edit-privacy-heading"><Eye size={22} aria-hidden="true" /><h2>Quyền hiển thị</h2></div>
          <p>Chọn cách người khác tìm và kết nối với bạn.</p>
          {privacyLoading && <div role="status" className="penpot-edit-privacy-note">Đang tải quyền riêng tư...</div>}
          {privacyError && <div role="alert" className="penpot-edit-privacy-error">{privacyError}
            <button type="button" onClick={retryPrivacy}>Thử lại</button>
          </div>}
          {privacy && <div className="penpot-edit-privacy-rows">
            {accessRows.map(row => (
              <div className="penpot-edit-privacy-row" key={row.key}>
                <div><strong>{row.title}</strong><small>{row.subtitle}</small></div>
                <button type="button" role="switch" className={privacy[row.key] ? 'is-on' : ''}
                  aria-label={row.title} aria-checked={privacy[row.key]} disabled={privacyBusy}
                  onClick={() => void changePrivacy(row.key)}>
                  <span>{privacy[row.key] ? 'Bật' : 'Tắt'}</span><i aria-hidden="true"><Check size={11}/></i>
                </button>
              </div>
            ))}
          </div>}
          <p className="penpot-edit-privacy-foot"><ShieldCheck size={16} aria-hidden="true" /> Cài đặt này lưu riêng trên máy chủ, không phụ thuộc nút Lưu hồ sơ.</p>
        </section>
      </aside>
    </div>
  )
}
