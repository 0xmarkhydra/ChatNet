import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowLeft, Camera, RotateCcw, Save } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ProfileEditorPrivacyCard from './ProfileEditorPrivacyCard'
import ProfileEditorPreview from './ProfileEditorPreview'
import type { ProfileMediaState, ProfilePublicDetails, UserPrivacy } from '../types'
import ProfilePublicDetailsFields from './ProfilePublicDetailsFields'
import { profileEditorFieldClass, profileEditorInputClass, profileEditorLabelClass } from './profileEditorFieldStyles'

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
  publicDetailsDraft: ProfilePublicDetails
  setPublicDetailsDraft: (value: ProfilePublicDetails) => void
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
  onChangeAvatar: (opener: HTMLButtonElement) => void
  onChangeCover: () => void
}


export default function ProfileEditorPage({
  profile, username, displayName, coverUrl,
  displayNameDraft, setDisplayNameDraft, usernameDraft, setUsernameDraft,
  bioDraft, setBioDraft, cityDraft, setCityDraft, publicDetailsDraft, setPublicDetailsDraft, profileSaving, mediaBusy,
  privacy, privacyBusy, privacyLoading, privacyError, retryPrivacy, changePrivacy,
  onSave, onDiscard, onChangeAvatar, onChangeCover,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  const same = Boolean(profile) &&
    displayNameDraft.trim() === profile?.displayName &&
    usernameDraft.trim().toLowerCase() === profile?.username &&
    bioDraft.trim() === (profile?.bio ?? '') &&
    cityDraft.trim() === (profile?.city ?? '') &&
    publicDetailsDraft.workplace.trim() === (profile?.workplace ?? '') &&
    publicDetailsDraft.school.trim() === (profile?.school ?? '')
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
        <div className="profile-editor-form-heading app-desktop:flex app-desktop:min-h-[77px] app-desktop:items-start app-desktop:gap-[9px] app-desktop:[&>div]:min-w-0 app-desktop:[&>div]:flex-1">
          <button type="button" className="profile-editor-back" onClick={onDiscard} aria-label="Quay lại hồ sơ" title="Quay lại hồ sơ"><ArrowLeft size={20} aria-hidden="true" /></button>
          <div>
            <h1 ref={heading} tabIndex={-1} className="app-desktop:m-0 app-desktop:text-[22px] app-desktop:font-[780] app-desktop:leading-[30px] app-desktop:tracking-[-.3px] app-desktop:text-[#192c4c]">Thông tin cơ bản</h1>
            <p className="app-desktop:mt-[5px] app-desktop:text-[13px] app-desktop:leading-5 app-desktop:text-[#8492aa]">Chỉ thay đổi những thông tin bạn muốn người khác nhìn thấy.</p>
          </div>
        </div>

        <div className="profile-editor-cover-slot app-desktop:mt-[3px] app-desktop:shrink-0">{cover(false)}</div>
        <div className="profile-editor-avatar-ring">
          <UserAvatar username={username} name={displayName} className="profile-editor-avatar" online />
          <button type="button" className="profile-editor-avatar-button" disabled={mediaBusy} onClick={event => onChangeAvatar(event.currentTarget)}
            aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"><Camera size={17} aria-hidden="true" /></button>
        </div>

        <div className="profile-editor-fields app-desktop:mt-[27px] app-desktop:mb-[30px] app-desktop:mr-[6px] app-desktop:ml-[14px] app-desktop:grid app-desktop:gap-[15px] app-desktop:max-[1000px]:mx-0">
          <label className={profileEditorFieldClass}>
            <span className={profileEditorLabelClass}>Tên hiển thị</span>
            <input className={profileEditorInputClass} autoComplete="name" type="text" name="displayName" required maxLength={100} disabled={profileSaving}
              value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)}
              placeholder="Nhập tên hiển thị" />
          </label>
          <label className={profileEditorFieldClass}>
            <span className={profileEditorLabelClass}>Tên người dùng</span>
            <input className={profileEditorInputClass} autoComplete="username" type="text" name="username" required minLength={3} maxLength={32}
              autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={profileSaving}
              value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.toLowerCase())}
              placeholder="Tên người dùng duy nhất" />
          </label>
          <label className={profileEditorFieldClass}>
            <span className={profileEditorLabelClass}>Tiểu sử</span>
            <input className={profileEditorInputClass} type="text" name="bio" maxLength={160} disabled={profileSaving} value={bioDraft}
              onChange={event => setBioDraft(event.target.value)} placeholder="Một chút giới thiệu về bạn" />
          </label>
          <label className={profileEditorFieldClass}>
            <span className={profileEditorLabelClass}>Thành phố</span>
            <input className={profileEditorInputClass} type="text" name="city" maxLength={100} disabled={profileSaving} value={cityDraft}
              onChange={event => setCityDraft(event.target.value)} placeholder="Thành phố bạn muốn chia sẻ" />
          </label>
          <ProfilePublicDetailsFields value={publicDetailsDraft} onChange={setPublicDetailsDraft}
            fieldClass={profileEditorFieldClass} labelClass={profileEditorLabelClass} inputClass={profileEditorInputClass} disabled={profileSaving} />
        </div>
        <footer className="profile-editor-form-footer app-desktop:mt-auto app-desktop:flex app-desktop:min-h-[67px] app-desktop:flex-wrap app-desktop:items-end app-desktop:justify-end app-desktop:gap-[13px] app-desktop:border-t app-desktop:border-border-subtle app-desktop:pt-[21px] app-desktop:pr-[7px]">
          <span className="profile-editor-save-hint app-desktop:mr-auto app-desktop:max-w-[260px] app-desktop:flex-[1_1_150px] app-desktop:self-center app-desktop:text-[11px] app-desktop:leading-[1.4] app-desktop:text-[#8291aa] app-desktop:max-[1000px]:max-w-none app-desktop:max-[1000px]:basis-full">Ảnh và quyền hiển thị được cập nhật ngay sau khi thay đổi.</span>
          <button type="button" className="profile-editor-discard" onClick={onDiscard} disabled={profileSaving}>
            <RotateCcw size={17} aria-hidden="true" /> Hủy thay đổi
          </button>
          <button type="submit" className="profile-editor-submit" disabled={savingDisabled}>
            <><Save size={17} aria-hidden="true" /> Lưu hồ sơ</>
          </button>
        </footer>
      </form>

      <aside className="profile-editor-side app-desktop:grid app-desktop:min-w-0 app-desktop:content-start app-desktop:gap-6 app-desktop:max-[1380px]:w-full app-desktop:max-[1380px]:shrink-0 app-desktop:max-[1380px]:grid-cols-2 app-desktop:max-[1380px]:gap-[15px] app-desktop:max-[1000px]:grid-cols-1" aria-label="Xem trước và quyền hiển thị">
        <ProfileEditorPreview profile={profile} cover={cover(true)} username={username} displayName={displayName} displayNameDraft={displayNameDraft} usernameDraft={usernameDraft} bioDraft={bioDraft} cityDraft={cityDraft} />

        <ProfileEditorPrivacyCard privacy={privacy} privacyBusy={privacyBusy} privacyError={privacyError} retryPrivacy={retryPrivacy} changePrivacy={changePrivacy} />
      </aside>
    </div>
  )
}