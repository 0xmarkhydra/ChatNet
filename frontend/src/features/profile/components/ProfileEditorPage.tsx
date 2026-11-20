import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowLeft, Camera, RotateCcw, Save } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ProfileEditorPrivacyCard from './ProfileEditorPrivacyCard'
import ProfileEditorPreview from './ProfileEditorPreview'
import type { ProfileMediaState, UserPrivacy } from '../types'

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


export default function ProfileEditorPage({
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

  const cover = (preview: boolean) => (
    <div className={preview ? 'profile-editor-cover profile-editor-preview-cover' : 'profile-editor-cover'}>
      {profile?.coverSet && coverUrl && <img src={coverUrl} alt={preview ? '' : 'Ảnh bìa hiện tại'}
        onError={event => { event.currentTarget.hidden = true }} />}
      {!preview && <button type="button" className="profile-editor-cover-button" onClick={onChangeCover} disabled={mediaBusy} aria-label="Đổi ảnh bìa">
        <Camera size={17} aria-hidden="true" /> Đổi ảnh bìa
      </button>}
    </div>
  )

  return (
    <div className="profile-editor-page" aria-label="Chỉnh sửa hồ sơ">
      <form className="profile-editor-form-card" onSubmit={onSave}>
        <div className="profile-editor-form-heading min-[761px]:flex min-[761px]:min-h-[77px] min-[761px]:items-start min-[761px]:gap-[9px] min-[761px]:[&>div]:min-w-0 min-[761px]:[&>div]:flex-1">
          <button type="button" className="profile-editor-back" onClick={onDiscard} aria-label="Quay lại hồ sơ" title="Quay lại hồ sơ"><ArrowLeft size={20} aria-hidden="true" /></button>
          <div>
            <h1 ref={heading} tabIndex={-1} className="min-[761px]:m-0 min-[761px]:text-[22px] min-[761px]:font-extrabold min-[761px]:leading-[30px] min-[761px]:tracking-[-.3px] min-[761px]:text-[#192c4c]">Thông tin cơ bản</h1>
            <p className="min-[761px]:mt-[5px] min-[761px]:text-[13px] min-[761px]:leading-5 min-[761px]:text-[#8492aa]">Chỉ thay đổi những thông tin bạn muốn người khác nhìn thấy.</p>
          </div>
        </div>

        <div className="profile-editor-cover-slot min-[761px]:mt-[3px] min-[761px]:shrink-0">{cover(false)}</div>
        <div className="profile-editor-avatar-ring">
          <UserAvatar username={username} name={displayName} className="profile-editor-avatar" online />
          <button type="button" className="profile-editor-avatar-button" disabled={mediaBusy} onClick={onChangeAvatar}
            aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"><Camera size={17} aria-hidden="true" /></button>
        </div>

        <div className="profile-editor-fields min-[761px]:mt-[27px] min-[761px]:mb-[30px] min-[761px]:mr-[6px] min-[761px]:ml-[14px] min-[761px]:grid min-[761px]:gap-[15px] min-[761px]:max-[1000px]:mx-0">
          <label className="profile-editor-field min-[761px]:grid min-[761px]:min-w-0 min-[761px]:gap-[11px]">
            <span className="min-[761px]:text-[13px] min-[761px]:font-semibold min-[761px]:leading-4 min-[761px]:text-[#495d7d]">Tên hiển thị</span>
            <input className="min-[761px]:box-border min-[761px]:h-[45px] min-[761px]:w-full min-[761px]:min-w-0 min-[761px]:rounded-[10px] min-[761px]:border min-[761px]:border-transparent min-[761px]:bg-[#f8fafe] min-[761px]:px-[15px] min-[761px]:text-[13px] min-[761px]:font-medium min-[761px]:text-[#344561] min-[761px]:outline-none min-[761px]:placeholder:text-[#a1adc0] min-[761px]:focus-visible:border-[#9ab9ff] min-[761px]:focus-visible:ring-[3px] min-[761px]:focus-visible:ring-blue-500/10" autoComplete="name" type="text" name="displayName" required maxLength={100} disabled={profileSaving}
              value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)}
              placeholder="Nhập tên hiển thị" />
          </label>
          <label className="profile-editor-field min-[761px]:grid min-[761px]:min-w-0 min-[761px]:gap-[11px]">
            <span className="min-[761px]:text-[13px] min-[761px]:font-semibold min-[761px]:leading-4 min-[761px]:text-[#495d7d]">Tên người dùng</span>
            <input className="min-[761px]:box-border min-[761px]:h-[45px] min-[761px]:w-full min-[761px]:min-w-0 min-[761px]:rounded-[10px] min-[761px]:border min-[761px]:border-transparent min-[761px]:bg-[#f8fafe] min-[761px]:px-[15px] min-[761px]:text-[13px] min-[761px]:font-medium min-[761px]:text-[#344561] min-[761px]:outline-none min-[761px]:placeholder:text-[#a1adc0] min-[761px]:focus-visible:border-[#9ab9ff] min-[761px]:focus-visible:ring-[3px] min-[761px]:focus-visible:ring-blue-500/10" autoComplete="username" type="text" name="username" required minLength={3} maxLength={32}
              autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={profileSaving}
              value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.toLowerCase())}
              placeholder="Tên người dùng duy nhất" />
          </label>
          <label className="profile-editor-field min-[761px]:grid min-[761px]:min-w-0 min-[761px]:gap-[11px]">
            <span className="min-[761px]:text-[13px] min-[761px]:font-semibold min-[761px]:leading-4 min-[761px]:text-[#495d7d]">Tiểu sử</span>
            <input className="min-[761px]:box-border min-[761px]:h-[45px] min-[761px]:w-full min-[761px]:min-w-0 min-[761px]:rounded-[10px] min-[761px]:border min-[761px]:border-transparent min-[761px]:bg-[#f8fafe] min-[761px]:px-[15px] min-[761px]:text-[13px] min-[761px]:font-medium min-[761px]:text-[#344561] min-[761px]:outline-none min-[761px]:placeholder:text-[#a1adc0] min-[761px]:focus-visible:border-[#9ab9ff] min-[761px]:focus-visible:ring-[3px] min-[761px]:focus-visible:ring-blue-500/10" type="text" name="bio" maxLength={160} disabled={profileSaving} value={bioDraft}
              onChange={event => setBioDraft(event.target.value)} placeholder="Một chút giới thiệu về bạn" />
          </label>
          <label className="profile-editor-field min-[761px]:grid min-[761px]:min-w-0 min-[761px]:gap-[11px]">
            <span className="min-[761px]:text-[13px] min-[761px]:font-semibold min-[761px]:leading-4 min-[761px]:text-[#495d7d]">Thành phố</span>
            <input className="min-[761px]:box-border min-[761px]:h-[45px] min-[761px]:w-full min-[761px]:min-w-0 min-[761px]:rounded-[10px] min-[761px]:border min-[761px]:border-transparent min-[761px]:bg-[#f8fafe] min-[761px]:px-[15px] min-[761px]:text-[13px] min-[761px]:font-medium min-[761px]:text-[#344561] min-[761px]:outline-none min-[761px]:placeholder:text-[#a1adc0] min-[761px]:focus-visible:border-[#9ab9ff] min-[761px]:focus-visible:ring-[3px] min-[761px]:focus-visible:ring-blue-500/10" type="text" name="city" maxLength={100} disabled={profileSaving} value={cityDraft}
              onChange={event => setCityDraft(event.target.value)} placeholder="Thành phố bạn muốn chia sẻ" />
          </label>
        </div>
        <footer className="profile-editor-form-footer min-[761px]:mt-auto min-[761px]:flex min-[761px]:min-h-[67px] min-[761px]:flex-wrap min-[761px]:items-end min-[761px]:justify-end min-[761px]:gap-[13px] min-[761px]:border-t min-[761px]:border-[#e8ecf5] min-[761px]:pt-[21px] min-[761px]:pr-[7px]">
          <span className="profile-editor-save-hint min-[761px]:mr-auto min-[761px]:max-w-[260px] min-[761px]:flex-[1_1_150px] min-[761px]:self-center min-[761px]:text-[11px] min-[761px]:leading-[1.4] min-[761px]:text-[#8291aa] min-[761px]:max-[1000px]:max-w-none min-[761px]:max-[1000px]:basis-full">Ảnh và quyền hiển thị được cập nhật ngay sau khi thay đổi.</span>
          <button type="button" className="profile-editor-discard" onClick={onDiscard} disabled={profileSaving}>
            <RotateCcw size={17} aria-hidden="true" /> Hủy thay đổi
          </button>
          <button type="submit" className="profile-editor-submit" disabled={savingDisabled}>
            <><Save size={17} aria-hidden="true" /> Lưu hồ sơ</>
          </button>
        </footer>
      </form>

      <aside className="profile-editor-side min-[761px]:grid min-[761px]:min-w-0 min-[761px]:content-start min-[761px]:gap-6 min-[761px]:max-[1380px]:w-full min-[761px]:max-[1380px]:shrink-0 min-[761px]:max-[1380px]:grid-cols-2 min-[761px]:max-[1380px]:gap-[15px] min-[761px]:max-[1000px]:grid-cols-1" aria-label="Xem trước và quyền hiển thị">
        <ProfileEditorPreview profile={profile} cover={cover(true)} username={username} displayName={displayName} displayNameDraft={displayNameDraft} usernameDraft={usernameDraft} bioDraft={bioDraft} cityDraft={cityDraft} />

        <ProfileEditorPrivacyCard privacy={privacy} privacyBusy={privacyBusy} privacyError={privacyError} retryPrivacy={retryPrivacy} changePrivacy={changePrivacy} />
      </aside>
    </div>
  )
}