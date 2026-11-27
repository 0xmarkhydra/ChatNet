// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import PostComposer from './PostComposer'
import type { TaggedFriend } from './PostTagPicker'
import type { MediaAttachment } from '../../../shared/utils/media'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

function ComposerHarness() {
  const [postText, setPostText] = useState('')
  const [postBackground, setPostBackground] = useState('')
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([])
  const [showPostBackgrounds, setShowPostBackgrounds] = useState(false)
  const [postVisibility, setPostVisibility] = useState<'public' | 'friends' | 'private'>('public')
  const [taggedFriends, setTaggedFriends] = useState<TaggedFriend[]>([])
  const [feelingId, setFeelingId] = useState('')
  const postComposerRef = useRef<HTMLTextAreaElement>(null)
  const feedAlbumInputRef = useRef<HTMLInputElement>(null)

  return <PostComposer name="viewer" createPost={vi.fn()} postComposerRef={postComposerRef}
    postBackground={postBackground} setPostBackground={setPostBackground} pendingPost={null}
    postText={postText} setPostText={setPostText} taggableFriends={[]}
    taggedFriends={taggedFriends} setTaggedFriends={setTaggedFriends} feelingId={feelingId}
    setFeelingId={setFeelingId} feedAlbumInputRef={feedAlbumInputRef}
    addFeedFiles={async () => undefined} postAttachments={postAttachments}
    setPostAttachments={setPostAttachments} mediaUploading={null}
    showPostBackgrounds={showPostBackgrounds} setShowPostBackgrounds={setShowPostBackgrounds}
    postVisibility={postVisibility} setPostVisibility={setPostVisibility} />
}

let host: HTMLDivElement | undefined
let root: Root | undefined

function mount(ui: ReactNode) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root?.render(ui))
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  host?.remove()
  host = undefined
})

it('does not show public location disclosure in composer', () => {
  mount(<ComposerHarness />)

  expect(Array.from(host?.querySelectorAll('p') ?? []).some(paragraph => paragraph.textContent?.includes('BigDataCloud'))).toBe(false)
})
