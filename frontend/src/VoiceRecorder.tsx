import { useEffect, useRef, useState } from 'react'
import { Check, Mic, X } from 'lucide-react'
import { preferredVoiceMime, voiceFileType } from './voiceMedia'

const MAX_RECORDING_MS = 120_000

function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function VoiceRecorder({
  disabled,
  onRecorded,
  onError,
}: {
  disabled: boolean
  onRecorded: (file: File) => void
  onError: (message: string) => void
}) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'finalizing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const clockRef = useRef<number | null>(null)
  const requestGeneration = useRef(0)
  const mounted = useRef(true)
  const saveRequested = useRef(false)

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (clockRef.current !== null) window.clearInterval(clockRef.current)
    clockRef.current = null
  }

  function stopRecording(save: boolean) {
    saveRequested.current = save
    const recorder = recorderRef.current
    if (!recorder) return
    if (mounted.current) setPhase('finalizing')
    if (recorder.state !== 'inactive') recorder.stop()
    else stopTracks()
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestGeneration.current++
      saveRequested.current = false
      if (recorderRef.current?.state !== 'inactive') {
        try { recorderRef.current?.stop() } catch { /* Already stopped */ }
      }
      stopTracks()
    }
  }, [])

  async function startRecording() {
    if (disabled || phase !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Trình duyệt này chưa hỗ trợ ghi âm. Hãy cập nhật Safari/Chrome và dùng HTTPS.')
      return
    }
    setPhase('requesting')
    const generation = ++requestGeneration.current
    let stream: MediaStream | null = null
    try {
      // Microphone permission is requested from the browser upon user action.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (!mounted.current || requestGeneration.current !== generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const preferred = preferredVoiceMime((type) => MediaRecorder.isTypeSupported(type))
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorderRef.current = recorder
      saveRequested.current = false

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }
      recorder.onerror = () => {
        saveRequested.current = false
        if (mounted.current) onError('Không thể ghi âm. Hãy kiểm tra microphone và thử lại.')
      }
      recorder.onstop = () => {
        stopTracks()
        recorderRef.current = null
        if (!mounted.current) return
        setPhase('idle')
        setSeconds(0)
        if (!saveRequested.current) return
        saveRequested.current = false
        const detected = voiceFileType(recorder.mimeType || chunks[0]?.type || '')
        if (!detected) {
          onError('Định dạng ghi âm không được hỗ trợ để tải lên.')
          return
        }
        const blob = new Blob(chunks, { type: detected.contentType })
        if (!blob.size) {
          onError('Bản ghi âm rỗng. Hãy thử lại.')
          return
        }
        onRecorded(new File([blob], `voice-${Date.now()}.${detected.extension}`, { type: detected.contentType }))
      }

      recorder.start(500)
      setPhase('recording')
      setSeconds(0)
      const started = Date.now()
      clockRef.current = window.setInterval(() => {
        const elapsed = Date.now() - started
        setSeconds(Math.floor(elapsed / 1000))
        if (elapsed >= MAX_RECORDING_MS && recorderRef.current === recorder) stopRecording(true)
      }, 250)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      stopTracks()
      recorderRef.current = null
      if (!mounted.current || requestGeneration.current !== generation) return
      setPhase('idle')
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        onError('Microphone đang bị chặn. Hãy cho phép quyền ghi âm trong cài đặt trình duyệt/PWA.')
      } else {
        onError('Không khởi động được ghi âm. Hãy kiểm tra microphone hoặc kết nối HTTPS.')
      }
    }
  }

  if (phase === 'requesting') {
    return <span className="voice-recorder busy" role="status">Đang xin quyền mic…</span>
  }
  if (phase === 'finalizing') {
    return <span className="voice-recorder busy" role="status">Đang xử lý ghi âm…</span>
  }
  if (phase === 'recording') {
    return (
      <div className="voice-recorder recording" role="group" aria-label="Đang ghi âm tin nhắn">
        <span className="voice-recording-time" role="timer">● {formatDuration(seconds)} / 02:00</span>
        <button type="button" onClick={() => stopRecording(false)} aria-label="Hủy ghi âm">
          <X size={17} aria-hidden="true" /> Hủy
        </button>
        <button type="button" className="voice-save" onClick={() => stopRecording(true)} aria-label="Lưu ghi âm vào tin nhắn">
          <Check size={17} aria-hidden="true" /> Xong
        </button>
      </div>
    )
  }
  return (
    <button
      className="ghost-action voice-record-trigger"
      type="button"
      onClick={() => void startRecording()}
      disabled={disabled}
      aria-label="Ghi âm tin nhắn thoại"
      title="Ghi âm tối đa 2 phút"
    ><Mic size={21} aria-hidden="true" /></button>
  )
}
