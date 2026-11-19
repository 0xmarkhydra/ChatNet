import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import IncomingCallDialog from './IncomingCallDialog'
import type { CallMediaType, CallView } from '../lib/calls'

function renderIncomingCall(mediaType: CallMediaType) {
  const incoming: CallView = {
    id: 'incoming-call-test',
    conversationId: 1,
    createdBy: 2,
    mediaType,
    status: 'ringing',
    createdAt: '2026-01-01T00:00:00Z',
    role: 'participant',
    joined: false,
    incoming: true,
    canEnd: false,
    e2eeReady: true,
    configured: true,
  }

  return renderToStaticMarkup(
    <IncomingCallDialog
      incoming={incoming}
      incomingName="Người gọi"
      isGroup={false}
      busy={false}
      incomingPermission=""
      rejectIncoming={vi.fn()}
      acceptIncoming={vi.fn()}
      checkIncomingPermission={vi.fn()}
    />,
  )
}

describe('IncomingCallDialog permission guidance', () => {
  it('mentions only the microphone for an audio call', () => {
    const dialog = renderIncomingCall('audio')

    expect(dialog).toContain('quyền truy cập microphone trên thiết bị của bạn')
    expect(dialog).toContain('Microphone · Kiểm tra quyền')
    expect(dialog).not.toMatch(/camera/i)
  })

  it('preserves camera and microphone guidance and controls for a video call', () => {
    const dialog = renderIncomingCall('video')

    expect(dialog).toContain('quyền truy cập camera và microphone')
    expect(dialog).toContain('Camera · Kiểm tra quyền')
    expect(dialog).toContain('Microphone · Kiểm tra quyền')
    expect(dialog).toContain('tắt camera ngay khi kết nối')
  })
})