import { useUiTranslation } from '@/shared/i18n/locale'
import type { ProfilePublicDetails } from '../types'

type Props = {
  value: ProfilePublicDetails
  onChange: (value: ProfilePublicDetails) => void
  fieldClass: string
  labelClass?: string
  inputClass?: string
  disabled: boolean
}

export default function ProfilePublicDetailsFields({ value, onChange, fieldClass, labelClass, inputClass, disabled }: Props) {
  const trUi = useUiTranslation()

  return <>
    <label className={fieldClass}>
      <span className={labelClass}>Nơi làm việc</span>
      <input className={inputClass} type="text" name="workplace" maxLength={160} autoComplete="organization" value={value.workplace}
        onChange={event => onChange({ ...value, workplace: event.target.value })}
        placeholder={trUi("profile.profileVisibility")} disabled={disabled} />
    </label>
    <label className={fieldClass}>
      <span className={labelClass}>Trường học</span>
      <input className={inputClass} type="text" name="school" maxLength={160} value={value.school}
        onChange={event => onChange({ ...value, school: event.target.value })}
        placeholder={trUi("profile.profileVisibility")} disabled={disabled} />
    </label>
  </>
}
