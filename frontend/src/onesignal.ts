export type PushState = {
  permission: NotificationPermission | 'unsupported'
  supported: boolean
  optedIn: boolean
  subscriptionId?: string
}

type OneSignalAPI = {
  init: (options: Record<string, unknown>) => Promise<void>
  Notifications: {
    permission: boolean
    isPushSupported: () => boolean
    requestPermission: () => Promise<void>
    addEventListener?: (name: string, handler: () => void) => void
  }
  User: {
    PushSubscription: {
      id?: string
      optedIn: boolean
      optIn?: () => Promise<void>
      optOut?: () => Promise<void>
      addEventListener?: (name: string, handler: () => void) => void
    }
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalAPI) => void | Promise<void>>
  }
}

let sdkPromise: Promise<OneSignalAPI> | null = null
let initializedAppId = ''
let initialization: { appId: string; promise: Promise<void> } | null = null
let listenersBound = false
let stateHandler: ((state: PushState) => void | Promise<void>) | null = null

function nativePermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function snapshot(OneSignal: OneSignalAPI): PushState {
  const permission = nativePermission()
  const supported = Boolean(OneSignal.Notifications.isPushSupported?.())
  return {
    permission,
    supported,
    optedIn:
      supported &&
      permission === 'granted' &&
      OneSignal.User.PushSubscription.optedIn === true,
    subscriptionId: OneSignal.User.PushSubscription.id || undefined,
  }
}

function loadSDK(onError: () => void) {
  const existing = document.querySelector<HTMLScriptElement>('script[data-chatnet-onesignal]')
  if (existing) {
    existing.addEventListener('error', onError, { once: true })
    return existing
  }
  const script = document.createElement('script')
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
  script.defer = true
  script.dataset.chatnetOnesignal = '1'
  script.addEventListener('error', onError, { once: true })
  document.head.appendChild(script)
  return script
}

function getSDK(): Promise<OneSignalAPI> {
  if (sdkPromise) return sdkPromise
  const promise = new Promise<OneSignalAPI>((resolve, reject) => {
    let settled = false
    let script: HTMLScriptElement
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      callback()
    }
    const fail = () => finish(() => {
      script?.remove()
      reject(new Error('Không tải được OneSignal SDK.'))
    })
    const timeout = window.setTimeout(fail, 15000)

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      finish(() => resolve(OneSignal))
    })
    script = loadSDK(fail)
  }).catch((error) => {
    sdkPromise = null
    throw error
  })
  sdkPromise = promise
  return promise
}

async function waitForSubscription(
  OneSignal: OneSignalAPI,
  timeoutMs = 8000,
): Promise<PushState> {
  const expiresAt = Date.now() + timeoutMs
  let state = snapshot(OneSignal)

  while (
    Date.now() < expiresAt &&
    state.supported &&
    state.permission === 'granted' &&
    (!state.optedIn || !state.subscriptionId)
  ) {
    await new Promise((resolve) => window.setTimeout(resolve, 200))
    state = snapshot(OneSignal)
  }

  return state
}

async function emitState(OneSignal: OneSignalAPI) {
  if (!stateHandler) return
  let state = snapshot(OneSignal)
  if (state.optedIn && !state.subscriptionId) {
    state = await waitForSubscription(OneSignal)
  }
  await stateHandler(state)
}

async function initializeSDK(OneSignal: OneSignalAPI, appId: string) {
  if (initializedAppId) {
    if (initializedAppId !== appId) {
      throw new Error('OneSignal đã được khởi tạo với App ID khác.')
    }
    return
  }

  if (initialization) {
    if (initialization.appId !== appId) {
      throw new Error('OneSignal đang được khởi tạo với App ID khác.')
    }
    await initialization.promise
    return
  }

  const promise = OneSignal.init({
    appId,
    serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: { scope: '/push/onesignal/' },
    allowLocalhostAsSecureOrigin:
      location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  }).then(() => {
    initializedAppId = appId
  })
  initialization = { appId, promise }

  try {
    await promise
  } catch (error) {
    if (initialization?.promise === promise) initialization = null
    throw error
  }
}

export async function setupOneSignal(
  appId: string,
  onStateChange?: (state: PushState) => void | Promise<void>,
): Promise<PushState> {
  if (!appId) {
    return {
      permission: nativePermission(),
      supported: false,
      optedIn: false,
    }
  }

  const OneSignal = await getSDK()
  await initializeSDK(OneSignal, appId)

  stateHandler = onStateChange || null

  if (!listenersBound) {
    OneSignal.Notifications.addEventListener?.('permissionChange', () => {
      void emitState(OneSignal)
    })
    OneSignal.User.PushSubscription.addEventListener?.('change', () => {
      void emitState(OneSignal)
    })
    listenersBound = true
  }

  let state = snapshot(OneSignal)
  if (state.optedIn && !state.subscriptionId) {
    state = await waitForSubscription(OneSignal)
  }
  return state
}

export async function enableOneSignalPush(): Promise<PushState> {
  const OneSignal = await getSDK()
  if (!OneSignal.Notifications.isPushSupported?.()) {
    return snapshot(OneSignal)
  }

  if (OneSignal.User.PushSubscription.optedIn !== true) {
    await OneSignal.User.PushSubscription.optIn?.()
  }

  if (nativePermission() !== 'granted') {
    await OneSignal.Notifications.requestPermission()
  }

  let state = snapshot(OneSignal)
  if (state.supported && state.permission === 'granted' && (!state.optedIn || !state.subscriptionId)) {
    state = await waitForSubscription(OneSignal)
  }

  await emitState(OneSignal)
  return state
}

export async function disableOneSignalPush(): Promise<PushState> {
  const OneSignal = await getSDK()
  const before = snapshot(OneSignal)

  if (OneSignal.User.PushSubscription.optedIn === true) {
    await OneSignal.User.PushSubscription.optOut?.()
  }

  const after = snapshot(OneSignal)
  await emitState(OneSignal)
  return {
    ...after,
    subscriptionId: before.subscriptionId || after.subscriptionId,
  }
}

export async function getOneSignalPushState(): Promise<PushState> {
  const OneSignal = await getSDK()
  return snapshot(OneSignal)
}
