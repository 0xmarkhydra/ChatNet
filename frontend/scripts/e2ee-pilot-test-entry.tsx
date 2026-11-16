// Test-only module, dynamically loaded by Playwright. Not part of production UI.
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import E2EEPilotPanel from '../src/features/chat/components/E2EEPilotPanel'

declare global {
  interface Window {
    mountE2EEPilotTest: (selfId: number, peerId: number) => void
    unmountE2EEPilotTest: () => void
    e2eePilotTestMode?: string
  }
}
let root: Root | null = null
window.mountE2EEPilotTest = (selfId: number, peerId: number) => {
  const host = document.createElement('div')
  host.setAttribute('id', 'e2ee-ui-harness')
  document.body.append(host)
  root = createRoot(host)
  root.render(createElement(E2EEPilotPanel, {
    conversationId: 501,
    userId: selfId,
    otherUserId: peerId,
    request: (path: string, init?: RequestInit) => fetch(path, {
      ...init, headers: {
        ...init?.headers, 'X-Test-User': String(selfId),
      },
    }),
    onModeChange: mode => { window.e2eePilotTestMode = mode },
  }))
}
window.unmountE2EEPilotTest = () => {
  root?.unmount()
  root = null
  document.getElementById('e2ee-ui-harness')?.remove()
}
