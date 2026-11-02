import type { FormEvent } from 'react'
import type { UI_MESSAGES } from '../i18n/i18n'
import type { ProfileMediaState } from './types'

type Props = {
  saveProfileIdentity: (event: FormEvent) => void
  t: (key: keyof typeof UI_MESSAGES) => string
  profileDisplayNameDraft: string
  setProfileDisplayNameDraft: (value: string) => void
  profileUsernameDraft: string
  setProfileUsernameDraft: (value: string) => void
  profileSaving: boolean
  profileMedia: ProfileMediaState | null
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
}: Props) {
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
        <input
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
          <input
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
      <button
        type="submit"
        className="profile-save-button"
        disabled={
          profileSaving ||
          !profileMedia ||
          (
            profileDisplayNameDraft.trim() === profileMedia.displayName &&
            profileUsernameDraft.trim().toLowerCase() === profileMedia.username
          )
        }
      >
        {profileSaving ? t('common.saving') : t('common.save')}
      </button>
    </form>
  )
}
