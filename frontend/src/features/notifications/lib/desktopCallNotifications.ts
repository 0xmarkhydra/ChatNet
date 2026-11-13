import { desktopBridge, isDesktopBuild } from '../../../platform/desktop'

const unavailableEvent = 'soco:notification-unavailable'

export function notifyDesktopCall(sessionId: string, call: { id: string; conversationId: number; createdBy: number; createdAt: string }) {
  if (!isDesktopBuild) return
  void desktopBridge().notifications.show({
    sessionId, conversationId: call.conversationId, eventId: call.id, kind: 'call',
    senderId: call.createdBy, createdAt: call.createdAt,
  }).then((result) => {
    if (result.reason === 'unavailable') window.dispatchEvent(new Event(unavailableEvent))
  }).catch(() => window.dispatchEvent(new Event(unavailableEvent)))
}

export function dismissDesktopCall(sessionId: string, eventId: string) {
  if (isDesktopBuild) void desktopBridge().notifications.dismiss({ sessionId, eventId, kind: 'call' }).catch(() => undefined)
}
