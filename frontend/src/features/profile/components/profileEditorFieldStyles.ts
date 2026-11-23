// Keep all six editor inputs visually identical. The exact desktop dimensions and
// font weights preserve the approved editor while CSS declarations move to Tailwind.
// SocCO tokens are used where their values match; non-token values remain explicit.
// Font utilities need ! because the pre-existing unlayered global input reset
// sets font: inherit and font-size: 16px after Tailwind's utilities layer.
export const profileEditorFieldClass =
  'profile-editor-field min-[761px]:grid min-[761px]:min-w-0 min-[761px]:gap-[11px]'

export const profileEditorLabelClass =
  'min-[761px]:text-ui-label min-[761px]:font-[690] min-[761px]:leading-4 min-[761px]:text-[#495d7d]'

export const profileEditorInputClass =
  'min-[761px]:box-border min-[761px]:h-[45px] min-[761px]:w-full min-[761px]:min-w-0 ' +
  'min-[761px]:rounded-[10px] min-[761px]:border min-[761px]:border-transparent ' +
  'min-[761px]:bg-[#f8fafe] min-[761px]:px-[15px] min-[761px]:text-ui-label! ' +
  'min-[761px]:font-[510]! min-[761px]:text-[#344561] min-[761px]:outline-none ' +
  'min-[761px]:placeholder:text-[#a1adc0] min-[761px]:focus-visible:border-[#9ab9ff] ' +
  'min-[761px]:focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
