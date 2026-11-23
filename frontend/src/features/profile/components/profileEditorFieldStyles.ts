// Keep all six editor inputs visually identical. The exact desktop dimensions and
// font weights preserve the approved editor while CSS declarations move to Tailwind.
// SocCO tokens are used where their values match; non-token values remain explicit.
// Font utilities need ! because the pre-existing unlayered global input reset
// sets font: inherit and font-size: 16px after Tailwind's utilities layer.
export const profileEditorFieldClass =
  'profile-editor-field app-desktop:grid app-desktop:min-w-0 app-desktop:gap-[11px]'

export const profileEditorLabelClass =
  'app-desktop:text-ui-label app-desktop:font-[690] app-desktop:leading-4 app-desktop:text-[#495d7d]'

export const profileEditorInputClass =
  'app-desktop:box-border app-desktop:h-[45px] app-desktop:w-full app-desktop:min-w-0 ' +
  'app-desktop:rounded-[10px] app-desktop:border app-desktop:border-transparent ' +
  'app-desktop:bg-[#f8fafe] app-desktop:px-[15px] app-desktop:text-ui-label! ' +
  'app-desktop:font-[510]! app-desktop:text-[#344561] app-desktop:outline-none ' +
  'app-desktop:placeholder:text-[#a1adc0] app-desktop:focus-visible:border-[#9ab9ff] ' +
  'app-desktop:focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'