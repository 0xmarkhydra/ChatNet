export type DesktopPlatformInfo = {
  platform: 'darwin' | 'win32' | 'linux'
  version: string
  packaged: boolean
}

export type DesktopBridge = {
  getPlatformInfo: () => Promise<DesktopPlatformInfo>
  openExternal: (url: string) => Promise<boolean>
}

declare global {
  interface Window {
    socoDesktop?: DesktopBridge
  }
}

export const isDesktopBuild = import.meta.env.MODE === 'desktop'

export async function initializeDesktopPlatform(): Promise<void> {
  if (!isDesktopBuild) return
  document.documentElement.dataset.appPlatform = 'desktop'
  const bridge = window.socoDesktop
  if (!bridge) {
    document.documentElement.dataset.desktopShell = 'missing'
    return
  }
  const info = await bridge.getPlatformInfo()
  document.documentElement.dataset.desktopOS = info.platform
  document.documentElement.dataset.desktopShell = 'ready'
}
