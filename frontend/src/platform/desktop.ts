import type { Session } from '../features/auth/session'
import type { ManagedAccountSession } from '../features/auth/types'

export type DesktopPlatformInfo = {
  platform: 'darwin' | 'win32' | 'linux'
  version: string
  packaged: boolean
  apiOrigin: string
}

export type DesktopBridge = {
  getPlatformInfo: () => Promise<DesktopPlatformInfo>
  openExternal: (url: string) => Promise<boolean>
  auth: {
    restore: () => Promise<Session | null>
    verifyEmail: (input: { token: string; code: string }) => Promise<Session>
    refresh: (sessionId: string) => Promise<Session | null>
    logout: (input: { sessionId: string | null; revoke: boolean }) => Promise<{ revoked: boolean }>
    listSessions: (sessionId: string) => Promise<ManagedAccountSession[]>
    revokeSession: (sessionId: string, deviceId: string) => Promise<boolean>
    revokeOthers: (sessionId: string) => Promise<boolean>
    onExpired: (callback: (sessionId: string, userId: number) => void) => () => void
  }
}

declare global {
  interface Window {
    socoDesktop?: DesktopBridge
  }
}

export const isDesktopBuild = import.meta.env.MODE === 'desktop'

export function desktopBridge(): DesktopBridge {
  if (!isDesktopBuild || !window.socoDesktop?.auth) throw new Error('DESKTOP_BRIDGE_UNAVAILABLE')
  return window.socoDesktop
}

export async function initializeDesktopPlatform(): Promise<void> {
  if (!isDesktopBuild) return
  document.documentElement.dataset.appPlatform = 'desktop'
  const info = await desktopBridge().getPlatformInfo()
  document.documentElement.dataset.desktopOS = info.platform
  document.documentElement.dataset.desktopShell = 'ready'
}
