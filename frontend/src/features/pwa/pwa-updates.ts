export function watchPWAUpdates(onUpdate: () => void) {
  const workers = navigator.serviceWorker
  let registration: ServiceWorkerRegistration | undefined
  let disposed = false
  let checking = false
  let hadController = Boolean(workers.controller)
  let applying = false
  let reloaded = false
  const observed = new Set<ServiceWorker>()

  const reload = () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
  const stateChanged = () => {
    if (registration?.waiting && workers.controller) onUpdate()
  }
  const updateFound = () => {
    const worker = registration?.installing
    if (!worker || observed.has(worker)) return
    observed.add(worker)
    worker.addEventListener('statechange', stateChanged)
  }
  const controllerChanged = () => {
    if (applying) reload()
    else if (hadController) onUpdate()
    hadController = true
  }
  const check = async () => {
    if (!registration || checking || document.visibilityState === 'hidden' || !navigator.onLine) return
    checking = true
    try {
      await registration.update()
      if (!disposed) stateChanged()
    } catch {
      // Offline or a failed deployment must leave the current app usable.
    } finally {
      checking = false
    }
  }

  workers.addEventListener('controllerchange', controllerChanged)
  void workers.register('/sw.js', { updateViaCache: 'none' }).then((result) => {
    if (disposed) return
    registration = result
    registration.addEventListener('updatefound', updateFound)
    updateFound()
    stateChanged()
    void check()
  }).catch((error: unknown) => console.warn('PWA registration failed', error))

  const interval = window.setInterval(() => void check(), 60_000)
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)

  return {
    apply() {
      applying = true
      if (registration?.waiting) registration.waiting.postMessage('SKIP_WAITING')
      else reload()
    },
    stop() {
      disposed = true
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      workers.removeEventListener('controllerchange', controllerChanged)
      registration?.removeEventListener('updatefound', updateFound)
      for (const worker of observed) worker.removeEventListener('statechange', stateChanged)
    },
  }
}
