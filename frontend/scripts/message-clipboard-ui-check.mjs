import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
try {
  const { default: MessageActions } = await server.ssrLoadModule('/src/features/chat/MessageActions.tsx')
  const { resolveMessageCopyTarget } = await server.ssrLoadModule('/src/features/chat/messageCopyTarget.ts')
  const render = (message, target = resolveMessageCopyTarget(message, null)) =>
    renderToStaticMarkup(React.createElement(MessageActions, {
      activeMessageAction: message, userId: 1, setMessageActionId() {},
      toggleReaction: async () => {}, setReplyingTo() {},
      copyTarget: target, copyMessageContent: async () => {},
      translateMessage: async () => {}, editOwnMessage: async () => {}, recallOwnMessage: async () => {},
    }))
  const message = {
    id: 2, senderId: 2, sender: 'test_user', conversationId: 1,
    createdAt: '2026-11-05T11:00:00Z', reactions: [], deleted: false,
    text: '', attachments: [],
  }
  const image = { id: 9, kind: 'image', name: 'photo.png', storageRef: 's3://chat/img', url: 'https://media.example/photo.png' }
  const file = { id: 18, kind: 'file', name: 'Tài liệu.pdf',
    storageRef: 'chat/file-18', url: 'https://files.example/test.pdf?expires=1' }

  function assertSingleCopy(message, target, description) {
    const html = render(message, target)
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
    const copyButtons = buttons.filter((button) => button.includes('>Sao chép</b>'))
    assert.equal(copyButtons.length, 1, description + ': expected exactly one copy button')
    assert.match(copyButtons[0], /aria-hidden="true">▣<\/span>/)
    assert.doesNotMatch(html, /Sao chép (ảnh|liên kết|link|tệp)/i, description + ': no special copy buttons')
    return html
  }

  assert.equal(resolveMessageCopyTarget({ ...message, text: 'Lời chào' }, null)?.kind, 'text')
  assertSingleCopy({ ...message, text: 'Lời chào' }, undefined, 'plain text')

  const link = { ...message, text: 'https://example.com/report.pdf' }
  assert.deepEqual(resolveMessageCopyTarget(link, null), { kind: 'link', url: 'https://example.com/report.pdf' })
  assertSingleCopy(link, undefined, 'standalone link')
  assert.deepEqual(resolveMessageCopyTarget({ ...message, text: 'www.example.com/page' }, null),
    { kind: 'link', url: 'https://www.example.com/page' })

  const photo = { ...message, attachments: [image] }
  assert.equal(resolveMessageCopyTarget(photo, null)?.kind, 'image')
  assertSingleCopy(photo, undefined, 'image only')

  const fileOnly = { ...message, attachments: [file] }
  assert.deepEqual(resolveMessageCopyTarget(fileOnly, null),
    { kind: 'link', url: file.url, temporary: true })
  assert.match(assertSingleCopy(fileOnly, undefined, 'file only'), /\[Tệp\]/)

  const missing = { ...message, attachments: [{ ...file, url: undefined }] }
  assert.deepEqual(resolveMessageCopyTarget(missing, null), { kind: 'file-name', name: file.name })
  assertSingleCopy(missing, undefined, 'file without URL')

  const mixed = { ...message, text: 'Xem https://one.test rồi https://two.test',
    attachments: [image, { ...image, id: 10, storageRef: 'another' }, file] }
  const linkElement = { closest(selector) {
    return selector === 'a.message-inline-link' ? { href: 'https://two.test' } : null
  } }
  const imageElement = { closest(selector) {
    return selector === '.media-item' ? { dataset: { attachmentIndex: '1' } } : null
  } }
  const fileElement = { closest(selector) {
    return selector === '.media-item' ? { dataset: { attachmentIndex: '2' } } : null
  } }
  assert.deepEqual(resolveMessageCopyTarget(mixed, linkElement), { kind: 'link', url: 'https://two.test' })
  assert.deepEqual(resolveMessageCopyTarget(mixed, imageElement),
    { kind: 'image', attachment: mixed.attachments[1] })
  assert.deepEqual(resolveMessageCopyTarget(mixed, fileElement),
    { kind: 'link', url: file.url, temporary: true })
  assertSingleCopy(mixed, resolveMessageCopyTarget(mixed, null), 'mixed message text')
  assertSingleCopy(mixed, resolveMessageCopyTarget(mixed, linkElement), 'mixed message link')
  assertSingleCopy(mixed, resolveMessageCopyTarget(mixed, imageElement), 'mixed message image')
  assertSingleCopy(mixed, resolveMessageCopyTarget(mixed, fileElement), 'mixed message file')

  assert.doesNotMatch(render(message), />Sao chép<\/b>/)
  console.log('PASS: exactly one Sao chép button for text, links, images, files, mixed targets and missing URLs')
} finally {
  await server.close()
}
