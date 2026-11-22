import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProfileIdentityForm from './ProfileIdentityForm'
import type { ProfileMediaState } from '../types'

describe('ProfileIdentityForm shared UI controls', () => {
  const renderForm = (saving = false, changed = true, workplace = '') => renderToStaticMarkup(
    <ProfileIdentityForm
      saveProfileIdentity={vi.fn()}
      t={(key) => key}
      profileDisplayNameDraft={changed ? 'New name' : 'Current'}
      setProfileDisplayNameDraft={vi.fn()}
      profileUsernameDraft={changed ? 'newuser' : 'current'}
      setProfileUsernameDraft={vi.fn()}
      profileSaving={saving}
      cityDraft="" setCityDraft={vi.fn()}
      publicDetailsDraft={{ workplace, school: '' }} setPublicDetailsDraft={vi.fn()}
      profileMedia={{
        displayName: 'Current',
        username: 'current',
      } as ProfileMediaState}
    />,
  )

  it('preserves native input constraints and the existing CSS selectors', () => {
    const html = renderForm()
    expect(html.match(/data-slot="input"/g)).toHaveLength(3)
    expect(html).toContain('name="workplace"')
    expect(html).toContain('name="school"')
    expect(html).toContain('class="profile-edit-card"')
    expect(html).toContain('class="profile-username-input"')
    expect(html).toContain('maxLength="100"')
    expect(html).toContain('autoComplete="username"')
    expect(html).toContain('data-slot="button"')
    expect(html).toContain('type="submit"')
    expect(html).toContain('profile-save-button')
  })

  it('allows saving only the public details', () => {
    expect(renderForm(false, false, 'Đội sản phẩm')).not.toMatch(/<button[^>]*\sdisabled=""/g)
  })

  it('disables submit while saving or when identity is unchanged', () => {
    expect(renderForm(true)).toMatch(/<button[^>]*\sdisabled=""/g)
    expect(renderForm(false, false)).toMatch(/<button[^>]*\sdisabled=""/g)
    expect(renderForm(false, true)).not.toMatch(/<button[^>]*\sdisabled=""/g)
  })
})