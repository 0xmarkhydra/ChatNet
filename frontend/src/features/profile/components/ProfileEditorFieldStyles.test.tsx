import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProfileEditorPage from './ProfileEditorPage'
import ProfilePublicDetailsFields from './ProfilePublicDetailsFields'
import { profileEditorFieldClass, profileEditorLabelClass, profileEditorInputClass } from './profileEditorFieldStyles'

vi.mock('../../../shared/ui/UserAvatar', () => ({
  default: () => <span data-testid="avatar" />,
}))

describe('Profile Editor Tailwind parity', () => {
  it('applies identical desktop label and input styling to all six editor fields', () => {
    const markup = renderToStaticMarkup(<ProfileEditorPage
      profile={null} username="tester" displayName="Tester"
      displayNameDraft="Tester" setDisplayNameDraft={() => {}}
      usernameDraft="tester" setUsernameDraft={() => {}}
      bioDraft="" setBioDraft={() => {}}
      cityDraft="" setCityDraft={() => {}}
      publicDetailsDraft={{ workplace: '', school: '' }} setPublicDetailsDraft={() => {}}
      profileSaving={false} mediaBusy={false}
      privacy={null} privacyBusy={false} privacyLoading={false} privacyError=""
      retryPrivacy={() => {}} changePrivacy={async () => {}}
      onSave={() => {}} onDiscard={() => {}}
      onChangeAvatar={() => {}} onChangeCover={() => {}}
    />)

    expect((markup.match(/class="profile-editor-field min-\[761px\]:grid/g) ?? [])).toHaveLength(6)
    expect((markup.match(/min-\[761px\]:font-\[690\]/g) ?? [])).toHaveLength(6)
    expect((markup.match(/min-\[761px\]:font-\[510\]/g) ?? [])).toHaveLength(6)
    for (const field of ['displayName', 'username', 'bio', 'city', 'workplace', 'school']) {
      expect(markup).toContain(`name="${field}"`)
    }
    expect(markup).toContain('min-[761px]:font-[780]')
    expect(profileEditorInputClass).toContain('focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]')
  })

  it('keeps profile public details styling optional for other consumers', () => {
    const markup = renderToStaticMarkup(<ProfilePublicDetailsFields
      value={{ workplace: '', school: '' }} onChange={() => {}}
      fieldClass="unrelated-form-field" disabled={false}
    />)
    expect(markup).toContain('unrelated-form-field')
    expect(markup).not.toContain('min-[761px]:h-[45px]')
    expect(profileEditorFieldClass).toContain('profile-editor-field')
    expect(profileEditorLabelClass).toContain('font-[690]')
  })
})
