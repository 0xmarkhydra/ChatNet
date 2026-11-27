import { useUiTranslation } from '@/shared/i18n/locale'
import type { FormEvent } from 'react'
import { Input } from '../../../shared/ui/input'
import { Button } from '../../../shared/ui/button'
import type { UIMessageKey } from '../../i18n'
import type { ProfileMediaState, ProfilePublicDetails } from '../types'
import ProfilePublicDetailsFields from './ProfilePublicDetailsFields'

type Props = {
  saveProfileIdentity: (event: FormEvent) => void
  t: (key: UIMessageKey) => string
  profileDisplayNameDraft: string
  setProfileDisplayNameDraft: (value: string) => void
  profileUsernameDraft: string
  setProfileUsernameDraft: (value: string) => void
  profileSaving: boolean
  profileMedia: ProfileMediaState | null
  cityDraft: string
  setCityDraft: (value: string) => void
  publicDetailsDraft: ProfilePublicDetails
  setPublicDetailsDraft: (value: ProfilePublicDetails) => void
}

export default function ProfileIdentityForm({
  saveProfileIdentity,
  t,
  profileDisplayNameDraft,
  setProfileDisplayNameDraft,
  profileUsernameDraft,
  setProfileUsernameDraft,
  profileSaving,
  profileMedia,
  cityDraft, setCityDraft, publicDetailsDraft, setPublicDetailsDraft,
}: Props) {
  const trUi = useUiTranslation()

  return (
    <form className="profile-edit-card" onSubmit={saveProfileIdentity}>
      <div className="profile-edit-heading">
        <div>
          <strong>{t('profile.personalInfo')}</strong>
          <small>{t('profile.personalInfoHint')}</small>
        </div>
      </div>
      <label className="profile-edit-field">
        <span>{t('profile.displayName')}</span>
        <Input
          type="text"
          value={profileDisplayNameDraft}
          onChange={(event) => setProfileDisplayNameDraft(event.target.value)}
          maxLength={100}
          autoComplete="name"
          placeholder={t('profile.displayNamePlaceholder')}
          disabled={profileSaving}
        />
      </label>
      <label className="profile-edit-field">
        <span>{t('profile.username')}</span>
        <div className="profile-username-input">
          <b aria-hidden="true">@</b>
          <Input
            type="text"
            value={profileUsernameDraft}
            onChange={(event) => setProfileUsernameDraft(event.target.value.toLowerCase())}
            minLength={3}
            maxLength={32}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            placeholder="username"
            disabled={profileSaving}
          />
        </div>
        <small>{t('profile.usernameHint')}</small>
      </label>
      <label className="profile-edit-field">
        <span>Nơi sống</span>
        <Input name="city" maxLength={100} value={cityDraft} onChange={event => setCityDraft(event.target.value)}
          placeholder={trUi("profile.profileVisibility")} disabled={profileSaving} />
      </label>
      <ProfilePublicDetailsFields value={publicDetailsDraft} onChange={setPublicDetailsDraft}
        fieldClass="profile-edit-field" disabled={profileSaving} />
      <Button
        type="submit"
        className="profile-save-button"
        disabled={
          profileSaving ||
          !profileMedia ||
          (
            profileDisplayNameDraft.trim() === profileMedia.displayName &&
            profileUsernameDraft.trim().toLowerCase() === profileMedia.username &&
            cityDraft.trim() === (profileMedia.city ?? '') &&
            publicDetailsDraft.workplace.trim() === (profileMedia.workplace ?? '') &&
            publicDetailsDraft.school.trim() === (profileMedia.school ?? '')
          )
        }
      >
        {t('common.save')}
      </Button>
    </form>
  )
}