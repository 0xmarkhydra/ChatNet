import type { TextareaHTMLAttributes } from 'react'
import './bubble-textarea.css'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'rows'> & {
 value: string
}

// The hidden text sizes the grid; the textarea shares its padding and typography.
export default function BubbleTextarea({ value, placeholder, className = '', ...props }: Props) {
 return <div className={'bubble-textarea '+className}>
  <span className="bubble-textarea-sizer" aria-hidden="true">{(value || placeholder || ' ')+'\u200b'}</span>
  <textarea {...props} className="bubble-textarea-input" value={value} placeholder={placeholder} rows={1} />
 </div>
}
