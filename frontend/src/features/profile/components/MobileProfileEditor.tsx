import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, type FormEvent } from 'react'
import { UserRound } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '@/shared/ui/UserAvatar'
import { Button } from '@/shared/ui/button'
import type { ProfileMediaState, ProfilePublicDetails } from '../types'
import ProfilePublicDetailsFields from './ProfilePublicDetailsFields'

export type MobileProfileEditorProps = {
  profile: ProfileMediaState | null
  username: string
  displayName: string
  hasEmail: boolean
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
  saving: boolean
  mediaBusy: boolean
  onSave: (event: FormEvent) => void
  onDiscard: () => void
  onChangeAvatar: (opener: HTMLButtonElement) => void
  onChangeCover: () => void
}

export function confirmMobileProfileExit(dirty: boolean) {
  return !dirty || window.confirm('Bạn có thay đổi chưa lưu. Hủy thay đổi và quay lại?')
}

export function mobileProfileDirty(props: Pick<MobileProfileEditorProps, 'profile' | 'displayNameDraft' | 'usernameDraft' | 'bioDraft' | 'cityDraft' | 'publicDetailsDraft'>) {
  const { profile, displayNameDraft, usernameDraft, bioDraft, cityDraft, publicDetailsDraft } = props
  return !!profile && (displayNameDraft.trim() !== profile.displayName ||
    usernameDraft.trim().toLowerCase() !== profile.username ||
    bioDraft.trim() !== (profile.bio ?? '') || cityDraft.trim() !== (profile.city ?? '') ||
    publicDetailsDraft.workplace.trim() !== (profile.workplace ?? '') ||
    publicDetailsDraft.school.trim() !== (profile.school ?? ''))
}

const card = 'grid min-w-0 gap-ui-3 rounded-ui-lg bg-card p-ui-3'
const field = 'grid min-w-0 gap-ui-1 text-ui-body font-semibold'
const input = 'box-border min-h-control-touch w-full min-w-0 rounded-ui-md border border-solid border-border bg-surface-input px-ui-3 py-ui-2 text-ui-subtitle font-normal text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60'
const heading = 'm-0 text-ui-section font-bold text-foreground'

export default function MobileProfileEditor(props: MobileProfileEditorProps) {
  const trUi = useUiTranslation()

  const { profile, username, displayName, hasEmail, displayNameDraft, setDisplayNameDraft, usernameDraft, setUsernameDraft,
    bioDraft, setBioDraft, cityDraft, setCityDraft, publicDetailsDraft, setPublicDetailsDraft, saving, mediaBusy, onSave, onDiscard,
    onChangeAvatar, onChangeCover } = props
  const dirty = mobileProfileDirty(props)
  const valid = !!displayNameDraft.trim() && /^[a-z0-9][a-z0-9_.-]{1,30}[a-z0-9]$/.test(usernameDraft.trim())
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  if (!profile) return <div role="status" className={card}>Đang tải hồ sơ…<div aria-hidden="true" className="grid gap-ui-3 motion-safe:animate-pulse"><div className="mx-auto size-24 rounded-full bg-secondary" /><div className="h-28 rounded-ui-md bg-secondary" /><div className="h-14 rounded-ui-md bg-secondary" /></div></div>
  return <form className="grid min-w-0 gap-ui-3" onSubmit={event => {
    event.preventDefault()
    if (dirty && valid && !saving && !mediaBusy) onSave(event)
  }}>
    <section className={card}>
      <div className="flex items-center justify-between gap-ui-2"><h3 className={heading}>{trUi("profile.avatar")}</h3><Button variant="ghost" size="lg" className="px-ui-2 text-primary" disabled={mediaBusy || saving} onClick={event => onChangeAvatar(event.currentTarget)}>{profile.avatarSet ? trUi("common.editLabel") : trUi("common.more")}</Button></div>
      <div className="grid justify-items-center pb-ui-2">
        {profile.avatarSet ? <UserAvatar username={username} name={displayName} className="size-28 rounded-full" /> : <div className="grid size-28 place-items-center rounded-full bg-secondary text-primary"><UserRound size={52} aria-hidden="true" /></div>}
      </div>
    </section>
    <section className={card}>
      <div className="flex items-center justify-between gap-ui-2"><h3 className={heading}>{trUi("profile.cover")}</h3><Button variant="ghost" size="lg" className="px-ui-2 text-primary" disabled={mediaBusy || saving} onClick={onChangeCover}>{profile.coverSet ? trUi("common.editLabel") : trUi("common.more")}</Button></div>
      <div className="aspect-[2.6] overflow-hidden rounded-ui-md bg-secondary">{profile.coverSet && <img src={profileAssetUrl(username, 'cover', profile.updatedAt)} className="block size-full object-cover" alt={trUi("profile.currentCover")} />}</div>
      <small className="text-ui-caption text-foreground/75">Ảnh đại diện và ảnh bìa được lưu ngay khi thay đổi.</small>
    </section>
    <section className={card}>
      <h3 className={heading}>{trUi("profile.basicInfo")}</h3>
      <label className={field}>{trUi("profile.displayName")}<input className={input} name="displayName" autoComplete="name" required maxLength={100} disabled={saving} value={displayNameDraft} onChange={event => setDisplayNameDraft(event.target.value)} /></label>
      <label className={field}>Username<input className={input} name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={32} disabled={saving} value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.toLowerCase())} /><small className="text-ui-caption font-normal text-foreground/75">3–32 ký tự: chữ thường, số, dấu chấm, _ hoặc -. Bắt đầu và kết thúc bằng chữ hoặc số.</small></label>
    </section>
    <section className={card}>
      <h3 className={heading}>{trUi("profile.bio")}</h3>
      <label className="relative grid min-w-0"><span className="sr-only">{trUi("profile.bio")}</span><textarea className={input + ' min-h-28 resize-none pb-ui-6'} name="bio" maxLength={160} disabled={saving} value={bioDraft} onChange={event => setBioDraft(event.target.value)} placeholder={trUi("common.ui.shortBio")} /><small className="pointer-events-none absolute right-ui-3 bottom-ui-2 text-ui-caption text-foreground/75">{bioDraft.length}/160</small></label>
    </section>
    <section className={card}>
      <h3 className={heading}>Chi tiết</h3>
      <label className={field}>{trUi("profile.livesIn")}<input className={input} name="city" maxLength={100} disabled={saving} value={cityDraft} onChange={event => setCityDraft(event.target.value)} placeholder={trUi("common.ui.addResidence")} /></label>
      <ProfilePublicDetailsFields value={publicDetailsDraft} onChange={setPublicDetailsDraft} fieldClass={field} inputClass={input} disabled={saving} />
      {hasEmail && <p className="m-0 text-ui-label text-foreground/75">Email chỉ hiển thị với bạn.</p>}
    </section>
    <div role="group" aria-label={trUi("common.ui.profileEditActions")} className="sticky bottom-[var(--bottom-nav-space,84px)] z-10 -mx-3 grid grid-cols-[1fr_1.6fr] gap-ui-2 border-0 border-t border-solid border-border bg-card p-ui-3">
      <Button type="button" size="lg" variant="secondary" className="rounded-ui-md bg-secondary text-primary" disabled={saving || mediaBusy || !dirty} onClick={onDiscard}>{trUi("common.cancel")}</Button>
      <Button type="submit" size="lg" className="rounded-ui-md" disabled={saving || mediaBusy || !dirty || !valid}>{saving ? trUi("common.saving") : trUi("common.saveChanges")}</Button>
    </div>
  </form>
}