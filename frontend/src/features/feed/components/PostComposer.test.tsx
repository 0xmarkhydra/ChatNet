// @vitest-environment jsdom
import { act, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import PostComposer from './PostComposer'
import { UiLocaleContext } from '@/shared/i18n/locale'
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

it('localizes audience labels and descriptions in all five locales, retaining selection', () => {
  const render = (locale: string) => root!.render(<UiLocaleContext.Provider value={{ locale }}><ComposerHarness /></UiLocaleContext.Provider>)
  mount(<UiLocaleContext.Provider value={{locale:'vi'}}><ComposerHarness /></UiLocaleContext.Provider>)
  const trigger = () => host!.querySelector<HTMLButtonElement>('.smart-audience-trigger')!
  act(() => trigger().click())
  for (const [locale, heading, publicLabel, friendsLabel, privateLabel] of [
    ['vi','Ai có thể xem bài viết?','Công khai','Bạn bè','Chỉ mình tôi'],
    ['en','Who can see your post?','Public','Friends','Only me'],
    ['zh','谁可以查看你的帖子？','公开','好友','仅自己'],
    ['ja','投稿を閲覧できる人は？','公開','友達','自分のみ'],
    ['ko','누가 게시물을 볼 수 있나요?','공개','친구','나만 보기'],
  ]) {
    act(() => render(locale))
    expect(host!.querySelector('.smart-audience-menu-heading strong')?.textContent).toBe(heading)
    expect([...host!.querySelectorAll('[role="menuitemradio"]')].map(el => el.getAttribute('aria-label'))).toEqual([publicLabel,friendsLabel,privateLabel])
    expect(host!.querySelector('[aria-checked="true"]')?.getAttribute('aria-label')).toBe(publicLabel)
  }
  act(() => (host!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[2]).click())
  act(() => render('en'))
  expect(trigger().textContent).toBe('Only me')
  act(() => trigger().click())
  expect(host!.querySelector('[aria-checked="true"]')?.getAttribute('aria-label')).toBe('Only me')
})
