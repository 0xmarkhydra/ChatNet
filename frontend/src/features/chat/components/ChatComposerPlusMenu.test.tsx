import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import ChatComposerPlusMenu from './ChatComposerPlusMenu'

it('renders the visible plus glyph expected by chat composer styles', () => {
  const html = renderToStaticMarkup(
    <ChatComposerPlusMenu disabled={false} onAttachFile={() => {}} onAttachMedia={() => {}} onInsertEmoji={() => {}} />,
  )
  expect(html).toMatch(/class="[^"]*\bchat-composer-plus\b/)
  expect(html).toContain('aria-label="Mở menu thêm nội dung"')
})
