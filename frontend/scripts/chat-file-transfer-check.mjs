import assert from 'node:assert/strict'
import { chatFilesFromClipboard, transferHasFiles } from '../src/features/chat/chatFileTransfer.ts'

const screenshot = new File([new Uint8Array([1, 2, 3])], '', { type: 'image/png' })
const wordDoc = new File([new Uint8Array([4])], 'report.docx', {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
})
const now = new Date('2026-11-05T08:09:10.000Z')
const fileItem = (file) => ({ kind: 'file', getAsFile: () => file })
const textItem = () => ({ kind: 'string', getAsFile: () => null })

assert.equal(transferHasFiles({ types: ['Files', 'text/plain'] }), true)
assert.equal(transferHasFiles({ types: ['text/plain', 'text/html'] }), false)
assert.equal(transferHasFiles(null), false)
assert.deepEqual(chatFilesFromClipboard(null), [])
assert.deepEqual(chatFilesFromClipboard({ items: [textItem()], files: [] }), [], 'plain text must retain native paste')
const fromItems = chatFilesFromClipboard({
  items: [textItem(), fileItem(screenshot), fileItem(wordDoc)],
  files: [screenshot, wordDoc],
}, now)
assert.equal(fromItems.length, 2, 'items and files must not duplicate the same pasted files')
assert.match(fromItems[0].name, /^clipboard-2026-11-05T08-09-10-000Z-1\.png$/)
assert.equal(fromItems[0].type, 'image/png')
assert.equal(fromItems[0].size, screenshot.size)
assert.equal(fromItems[1], wordDoc, 'existing document names should be preserved')
const fallback = chatFilesFromClipboard({ items: [textItem()], files: [wordDoc] }, now)
assert.deepEqual(fallback, [wordDoc], 'Safari clipboardData.files fallback')
const plainScreenshot = new File([new Uint8Array([9])], 'screenshot.jpg', { type: 'image/jpeg' })
assert.equal(chatFilesFromClipboard({ items: [fileItem(plainScreenshot)], files: [] })[0], plainScreenshot)
const unsupported = new File(['test'], '', { type: 'application/unknown' })
assert.equal(chatFilesFromClipboard({ items: [fileItem(unsupported)], files: [] })[0], unsupported,
  'do not mislabel unknown clipboard bytes as an accepted format')

console.log('PASS: clipboard screenshots, copied documents, Safari fallback, no duplicate files, text paste unaffected, file drag detection')
