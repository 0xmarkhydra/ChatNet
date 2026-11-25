import { MapPin } from 'lucide-react'
import type { Post } from '../types'
import { postLocationTag } from '../utils/publicPostLocation'

export default function PostLocationTag({ post }: { post: Post }) {
  const tag = postLocationTag(post)
  if (!tag) return null
  return (
    <a className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary hover:underline" title={tag.title}
      href={tag.href} target="_blank" rel="noopener noreferrer">
      <MapPin size={14} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{tag.label}</span>
    </a>
  )
}
