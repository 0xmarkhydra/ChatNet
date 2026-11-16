// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import MediaAttachmentsView from './MediaAttachmentsView'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

afterEach(() => {
  document.body.innerHTML = ''
})

it('renders unavailable file attachments as text instead of broken links', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<MediaAttachmentsView items={[
      { storageRef: 'pending', name: 'Đang tải lên.pdf', sizeBytes: 1024, contentType: 'application/pdf', kind: 'file' },
      { storageRef: 'ready', name: 'Đã tải lên.pdf', sizeBytes: 2048, contentType: 'application/pdf', kind: 'file', url: '/attachments/file.pdf' },
    ]} />)
  })

  const cards = host.querySelectorAll('.media-file-card')
  expect(cards).toHaveLength(2)
  expect(cards[0].tagName).toBe('DIV')
  expect(cards[0].textContent).toContain('Đang tải lên.pdf')
  expect(cards[1].tagName).toBe('A')
  expect(cards[1].getAttribute('href')).toBe('/attachments/file.pdf')

  await act(async () => root.unmount())
})

it('labels embedded audio and video players by filename', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<MediaAttachmentsView items={[
      { storageRef: 'video', name: 'Chuyến đi.mp4', sizeBytes: 2048, contentType: 'video/mp4', kind: 'video', url: '/video.mp4' },
      { storageRef: 'audio', name: 'Tin nhắn.wav', sizeBytes: 1024, contentType: 'audio/wav', kind: 'audio', url: '/audio.wav' },
    ]} />)
  })
  expect(host.querySelector('video')?.getAttribute('aria-label')).toBe('Video: Chuyến đi.mp4')
  expect(host.querySelector('audio')?.getAttribute('aria-label')).toBe('Âm thanh: Tin nhắn.wav')
  await act(async () => root.unmount())
})
