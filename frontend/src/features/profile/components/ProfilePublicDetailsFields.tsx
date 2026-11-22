import type { ProfilePublicDetails } from '../types'

type Props = {
  value: ProfilePublicDetails
  onChange: (value: ProfilePublicDetails) => void
  fieldClass: string
  disabled: boolean
}

export default function ProfilePublicDetailsFields({ value, onChange, fieldClass, disabled }: Props) {
  return <>
    <label className={fieldClass}>
      <span>Nơi làm việc</span>
      <input type="text" name="workplace" maxLength={160} autoComplete="organization" value={value.workplace}
        onChange={event => onChange({ ...value, workplace: event.target.value })}
        placeholder="Tùy chọn · hiển thị trên hồ sơ" disabled={disabled} />
    </label>
    <label className={fieldClass}>
      <span>Trường học</span>
      <input type="text" name="school" maxLength={160} value={value.school}
        onChange={event => onChange({ ...value, school: event.target.value })}
        placeholder="Tùy chọn · hiển thị trên hồ sơ" disabled={disabled} />
    </label>
  </>
}
