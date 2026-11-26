import { MapPin } from 'lucide-react'
import type { Post } from '../types'
import { postLocationTag } from '../utils/publicPostLocation'

export default function PostLocationTag({ post }: { post: Post }) {
  const tag = postLocationTag(post)
  if (!tag) return null
  return (
    <div className="flex min-w-0 max-w-full items-start gap-1 text-xs leading-4">
      <MapPin size={14} className="mt-1 shrink-0 text-neutral-500" aria-hidden="true" />
      <a className="min-w-0 max-w-full rounded-md bg-neutral-100 px-1.5 py-0.5 line-clamp-2 break-words [overflow-wrap:anywhere] font-medium text-neutral-600 hover:bg-neutral-200 hover:underline focus-visible:underline" title={tag.label + ' · ' + tag.title}
        aria-label={'Mở bản đồ: ' + tag.label} href={tag.href} target="_blank" rel="noopener noreferrer">
        {tag.label}
      </a>
    </div>
  )
}