import { createUiTranslator } from '@/shared/i18n/locale'
import { loadAppLocalePreference } from '../shared/i18n/supportedLocales'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { desktopBridge, type DesktopScreenRequest } from './desktop'

export default function DesktopScreenPicker() {
  const trUi = createUiTranslator(loadAppLocalePreference())
  const [request, setRequest] = useState<DesktopScreenRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const latest = useRef(request)
  useLayoutEffect(() => {
    latest.current = request
  })
  useEffect(() => {
    const bridge = desktopBridge().screen
    const unsubscribe = bridge.onPicker((value) => { setBusy(false); setError(''); setRequest(value) })
    return () => {
      unsubscribe()
      const current = latest.current
      if (current) void bridge.select(current.requestId, null).catch(() => undefined)
    }
  }, [latest])
  useEffect(() => {
    const element = dialog.current
    if (!request || !element) return
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [request?.requestId])
  async function choose(index: number | null) {
    if (!request || busy) return
    const requestId = request.requestId
    setBusy(true)
    try {
      await desktopBridge().screen.select(requestId, index)
      setRequest((current) => current?.requestId === requestId ? null : current)
    } catch {
      // An expired native request must never trap the user in an unclosable modal.
      if (latest.current?.requestId !== requestId) return
      if (index === null) setRequest(null)
      else setError('expired')
    } finally { if (latest.current?.requestId === requestId) setBusy(false) }
  }
  if (!request) return null
  return (
    <dialog ref={dialog} className="desktop-screen-picker" aria-labelledby="desktop-screen-title"
      onCancel={(event) => { event.preventDefault(); void choose(null) }}>
      <h2 id="desktop-screen-title">{trUi("common.ui.screenSource")}</h2>
      <p>{trUi("common.ui.screenHint")}</p>
      {error && <p role="alert">{trUi("common.ui.screenExpired")}</p>}
      <div className="desktop-screen-grid">
        {request.sources.map((source) => <button type="button" key={source.index} disabled={busy}
          onClick={() => void choose(source.index)}>
          <img src={source.thumbnail} alt="" width="160" height="90" />
          <span>{source.name}</span>
        </button>)}
      </div>
      <button type="button" className="desktop-screen-cancel" disabled={busy} onClick={() => void choose(null)}>{trUi("common.ui.cancelShare")}</button>
    </dialog>
  )
}